//! Container that lets a scenario hand back its [`Stats`] plus any
//! scenario-specific findings the standard SLO check can't compute on its
//! own (single-flight upstream-call counts, retry caps, RSS deltas, etc.).
//!
//! The `notes` are printed verbatim under the latency table; `extra_failures`
//! are added to the SLO verdict so a scenario can fail the run for reasons
//! that aren't latency or error rate.

use crate::stats::Stats;

pub struct ScenarioOutcome {
    pub stats: Stats,
    /// Free-form (label, value) pairs displayed under the standard report.
    pub notes: Vec<(&'static str, String)>,
    /// Extra failure messages (one per breached scenario-specific
    /// invariant). Joined into the SLO verdict.
    pub extra_failures: Vec<String>,
}

impl ScenarioOutcome {
    pub fn new(stats: Stats) -> Self {
        Self {
            stats,
            notes: Vec::new(),
            extra_failures: Vec::new(),
        }
    }

    pub fn note(mut self, label: &'static str, value: impl Into<String>) -> Self {
        self.notes.push((label, value.into()));
        self
    }

    pub fn fail(mut self, msg: impl Into<String>) -> Self {
        self.extra_failures.push(msg.into());
        self
    }
}
