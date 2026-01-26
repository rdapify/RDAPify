import React from 'react';
import Layout from '@theme/Layout';

export default function Playground() {
  return (
    <Layout
      title="Playground"
      description="Try RDAPify before installing - Interactive RDAP query tool">
      <div style={{
        width: '100%',
        height: 'calc(100vh - 60px)',
        border: 'none',
        overflow: 'hidden'
      }}>
        <iframe
          src="/playground/index.html"
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          title="RDAPify Playground"
        />
      </div>
    </Layout>
  );
}
