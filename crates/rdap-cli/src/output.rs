//! Output formatting for CLI results.
//!
//! Four formats are supported:
//! - `--json`   — compact JSON, machine-readable (for pipes / scripts)
//! - `--pretty` — pretty-printed JSON (default for interactive use)
//! - `--text`   — human-readable summary of key fields
//! - `--csv`    — comma-separated, suited for batch export

/// Output format chosen by the user.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum OutputFormat {
    /// Compact (machine-readable) JSON — one object per line.
    Json,
    /// Pretty-printed JSON (default).
    #[default]
    Pretty,
    /// Human-readable key: value summary.
    Text,
    /// CSV — use with `rdapify batch` for export pipelines.
    Csv,
}

impl OutputFormat {
    /// Prints a single RDAP response value to stdout.
    pub fn print(self, value: &serde_json::Value) {
        match self {
            Self::Json => println!("{}", serde_json::to_string(value).unwrap()),
            Self::Pretty => println!("{}", serde_json::to_string_pretty(value).unwrap()),
            Self::Text => println!("{}", text_summary(value)),
            Self::Csv => {
                println!("{}", CSV_HEADER);
                println!("{}", csv_row(value, None));
            }
        }
    }

    /// Prints a CSV header line — call once before iterating batch results.
    pub fn print_csv_header(self) {
        if matches!(self, Self::Csv) {
            println!("{CSV_HEADER}");
        }
    }

    /// Prints a single batch item (success).
    pub fn print_batch_item(self, value: &serde_json::Value) {
        match self {
            Self::Json => println!("{}", serde_json::to_string(value).unwrap()),
            Self::Pretty => {
                println!("{}", serde_json::to_string_pretty(value).unwrap());
                println!("---");
            }
            Self::Text => println!("{}", batch_text_line(value, None)),
            Self::Csv => println!("{}", csv_row(value, None)),
        }
    }

    /// Prints a single batch item (error).
    pub fn print_batch_error(self, error_msg: &str) {
        match self {
            Self::Json => {
                let v = serde_json::json!({ "error": error_msg });
                println!("{}", serde_json::to_string(&v).unwrap());
            }
            Self::Pretty => eprintln!("Error: {error_msg}"),
            Self::Text => eprintln!("✗ {error_msg}"),
            Self::Csv => println!(",,,,,\"{error_msg}\""),
        }
    }
}

/// Resolves format flags into an `OutputFormat`.
///
/// Priority: `--json` > `--text` > `--csv` > `--pretty` > default (Pretty).
pub fn resolve_format(
    json: bool,
    pretty: bool,
    text: bool,
    csv: bool,
    config_format: Option<&str>,
) -> OutputFormat {
    if json {
        return OutputFormat::Json;
    }
    if text {
        return OutputFormat::Text;
    }
    if csv {
        return OutputFormat::Csv;
    }
    if pretty {
        return OutputFormat::Pretty;
    }
    // Fall back to config file preference
    match config_format {
        Some("json") => OutputFormat::Json,
        Some("text") => OutputFormat::Text,
        Some("csv") => OutputFormat::Csv,
        _ => OutputFormat::Pretty,
    }
}

// ── CSV ───────────────────────────────────────────────────────────────────────

const CSV_HEADER: &str = "name,type,status,registrar,created,expires,error";

fn csv_row(v: &serde_json::Value, error: Option<&str>) -> String {
    if let Some(e) = error {
        return format!(",,,,,\"{e}\"");
    }
    let name = extract_name(v);
    let obj_class = v
        .get("objectClassName")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let status = v
        .get("status")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .collect::<Vec<_>>()
                .join("|")
        })
        .unwrap_or_default();
    let registrar = extract_registrar(v);
    let (created, expires) = extract_dates(v);
    format!("{name},{obj_class},{status},{registrar},{created},{expires},")
}

// ── Text ──────────────────────────────────────────────────────────────────────

fn text_summary(v: &serde_json::Value) -> String {
    let mut lines: Vec<String> = Vec::new();

    if let Some(name) = v
        .get("ldhName")
        .or_else(|| v.get("handle"))
        .and_then(|v| v.as_str())
    {
        lines.push(format!("Name:      {name}"));
    }
    if let Some(class) = v.get("objectClassName").and_then(|v| v.as_str()) {
        lines.push(format!("Type:      {class}"));
    }
    if let Some(arr) = v.get("status").and_then(|v| v.as_array()) {
        let s: Vec<&str> = arr.iter().filter_map(|v| v.as_str()).collect();
        lines.push(format!("Status:    {}", s.join(", ")));
    }
    // IP-specific
    if let Some(start) = v.get("startAddress").and_then(|v| v.as_str()) {
        if let Some(end) = v.get("endAddress").and_then(|v| v.as_str()) {
            lines.push(format!("Range:     {start} – {end}"));
        }
    }
    // ASN-specific
    if let Some(start) = v.get("startAutnum").and_then(|v| v.as_u64()) {
        lines.push(format!("ASN range: AS{start}"));
    }
    if let Some(country) = v.get("country").and_then(|v| v.as_str()) {
        lines.push(format!("Country:   {country}"));
    }
    // Registrar
    let registrar = extract_registrar(v);
    if !registrar.is_empty() {
        lines.push(format!("Registrar: {registrar}"));
    }
    // Dates
    let (created, expires) = extract_dates(v);
    if !created.is_empty() {
        lines.push(format!("Created:   {created}"));
    }
    if !expires.is_empty() {
        lines.push(format!("Expires:   {expires}"));
    }

    if lines.is_empty() {
        serde_json::to_string_pretty(v).unwrap()
    } else {
        lines.join("\n")
    }
}

/// One-line summary for batch --text output.
pub fn batch_text_line(v: &serde_json::Value, error: Option<&str>) -> String {
    if let Some(e) = error {
        return format!("✗ {e}");
    }
    let name = extract_name(v);
    let status = v
        .get("status")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let registrar = extract_registrar(v);
    let (_, expires) = extract_dates(v);

    let mut parts = vec![format!("✓ {name}"), status.to_string()];
    if !registrar.is_empty() {
        parts.push(format!("registrar: {registrar}"));
    }
    if !expires.is_empty() {
        parts.push(format!("expires: {expires}"));
    }
    parts.join(" | ")
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn extract_name(v: &serde_json::Value) -> String {
    v.get("ldhName")
        .or_else(|| v.get("handle"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}

fn extract_registrar(v: &serde_json::Value) -> String {
    let entities = v.get("entities").and_then(|v| v.as_array());
    let Some(entities) = entities else {
        return String::new();
    };
    for entity in entities {
        let roles = entity.get("roles").and_then(|v| v.as_array());
        let is_registrar = roles.is_some_and(|r| {
            r.iter().any(|role| role.as_str() == Some("registrar"))
        });
        if is_registrar {
            // Try vcardArray first, then handle
            if let Some(name) = vcard_fn(entity).or_else(|| {
                entity
                    .get("handle")
                    .and_then(|v| v.as_str())
                    .map(String::from)
            }) {
                return name;
            }
        }
    }
    String::new()
}

fn vcard_fn(entity: &serde_json::Value) -> Option<String> {
    let vcard = entity.get("vcardArray")?.as_array()?;
    // vcardArray = ["vcard", [[type, {}, text, value], ...]]
    let props = vcard.get(1)?.as_array()?;
    for prop in props {
        let prop = prop.as_array()?;
        if prop.first()?.as_str() == Some("fn") {
            return prop.get(3).and_then(|v| v.as_str()).map(String::from);
        }
    }
    None
}

fn extract_dates(v: &serde_json::Value) -> (String, String) {
    let mut created = String::new();
    let mut expires = String::new();
    if let Some(events) = v.get("events").and_then(|v| v.as_array()) {
        for evt in events {
            let action = evt.get("eventAction").and_then(|v| v.as_str());
            let date = evt
                .get("eventDate")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            match action {
                Some("registration") => created = date,
                Some("expiration") => expires = date,
                _ => {}
            }
        }
    }
    (created, expires)
}
