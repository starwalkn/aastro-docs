// Kono — Aurora homepage
// Drop into: src/pages/index.js
//
// Note: this replaces the default Docusaurus tutorial homepage.
// If your current src/pages/index.js has custom logic, port it in
// rather than overwriting blindly.

import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

function ReleaseBadge() {
    return (
        <Link
            className="hero-badge"
            href="https://github.com/starwalkn/kono/releases">
            <span className="hero-badge__sparkle">✦</span>
            <span><strong>0.4.0</strong>&nbsp;just released</span>
            <span className="hero-badge__sep">—</span>
            <span>see what's new</span>
            <span className="hero-badge__arrow">→</span>
        </Link>
    );
}

function HomepageHeader() {
    const {siteConfig} = useDocusaurusContext();
    return (
        <header className="hero">
            <div className="container">
                <ReleaseBadge/>
                <Heading as="h1" className="hero__title">
                    {siteConfig.title}
                </Heading>
                <p className="hero__subtitle">{siteConfig.tagline}</p>
                <div className="hero-buttons">
                    <Link
                        className="button button--secondary button--lg"
                        to="/docs/getting-started">
                        Getting Started <span className="arrow">→</span>
                    </Link>
                    <Link
                        className="button button--secondary button--lg"
                        href="https://github.com/starwalkn/kono">
                        GitHub
                    </Link>
                </div>
            </div>
        </header>
    );
}

export default function Home() {
    const {siteConfig} = useDocusaurusContext();
    return (
        <Layout
            title={siteConfig.title}
            description={siteConfig.tagline}>
            <HomepageHeader/>
            <main>
                <HomepageFeatures/>
            </main>
        </Layout>
    );
}