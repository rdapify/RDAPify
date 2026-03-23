import React from 'react';
import BlogPostPage from '@theme-original/BlogPostPage';
import Head from '@docusaurus/Head';

function ArticleJsonLd({ content }) {
  if (!content || !content.metadata) return null;

  const { metadata, frontMatter } = content;
  const { title, description, date, authors, permalink } = metadata;

  const authorList = (authors || []).map((a) => ({
    '@type': 'Person',
    name: a.name || 'RDAPify Team',
    url: a.url || 'https://github.com/rdapify',
  }));

  const image = frontMatter && frontMatter.image
    ? `https://rdapify.com${frontMatter.image}`
    : 'https://rdapify.com/img/rdapify-social-card.png';

  const keywords = frontMatter && frontMatter.keywords
    ? (Array.isArray(frontMatter.keywords) ? frontMatter.keywords.join(', ') : frontMatter.keywords)
    : 'rdap, whois, domain lookup, rdapify';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description: description,
    image: image,
    datePublished: date,
    dateModified: date,
    author: authorList.length > 0
      ? authorList
      : { '@type': 'Organization', name: 'RDAPify Team', url: 'https://rdapify.com' },
    publisher: {
      '@type': 'Organization',
      name: 'RDAPify',
      url: 'https://rdapify.com',
      logo: {
        '@type': 'ImageObject',
        url: 'https://rdapify.com/img/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://rdapify.com${permalink}`,
    },
    keywords: keywords,
  };

  return (
    <Head>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Head>
  );
}

export default function BlogPostPageWrapper(props) {
  return (
    <>
      <ArticleJsonLd content={props.content} />
      <BlogPostPage {...props} />
    </>
  );
}
