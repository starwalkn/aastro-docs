import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const docs = [
    {
        title: 'Getting Started',
        description: 'Install Aastro and create your first gateway configuration.',
        href: '/docs/getting-started',
    },
    {
        title: 'Configuration',
        description: 'Configure upstreams, matching rules, and request dispatch.',
        href: '/docs/configuration',
    },
    {
        title: 'Metrics',
        description: 'Metrics overview.',
        href: '/docs/metrics',
    },
    {
        title: 'Tracing',
        description: 'Distributed tracing with OpenTelemetry.',
        href: '/docs/tracing',
    },
    {
        title: 'Plugins',
        description: 'Extend request and response pipelines with Go plugins.',
        href: '/docs/plugin-development',
    },
    {
        title: 'SSE',
        description: 'Streaming proxy mode for SSE and chunked transfer.',
        href: '/docs/passthrough',
    },
];

function DocCard({ title, description, href }) {
    return (
        <Link to={href} className={styles.card}>
            <div className={styles.cardContent}>
                <h3>{title}</h3>
                <p>{description}</p>
            </div>

            <span className={styles.arrow}>→</span>
        </Link>
    );
}

export default function HomepageFeatures() {
    return (
        <section className={clsx(styles.docsSection, 'homepage-features')}>
            <div className="container">
                <div className={styles.header}>
                    <h2>Documentation</h2>
                    <p>
                        Everything you need to build, extend, and operate Aastro.
                    </p>
                </div>

                <div className={styles.grid}>
                    {docs.map((doc, idx) => (
                        <DocCard key={idx} {...doc} />
                    ))}
                </div>
            </div>
        </section>
    );
}