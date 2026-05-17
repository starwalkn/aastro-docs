// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

const duotoneSea = {
    plain: {
        color: '#1D3B53',
        backgroundColor: '#F8FBFF',
    },
    styles: [
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8CA0B3', fontStyle: 'italic' } },
        { types: ['keyword', 'tag', 'operator'], style: { color: '#0C71C3' } },
        { types: ['string', 'attr-value', 'char'], style: { color: '#1B7AC4' } },
        { types: ['function', 'class-name'], style: { color: '#1A6FD4' } },
        { types: ['number', 'boolean', 'constant'], style: { color: '#0A5A9C' } },
        { types: ['punctuation'], style: { color: '#3D5A78' } },
        { types: ['variable', 'property'], style: { color: '#2C6FAC' } },
        { types: ['atrule', 'builtin'], style: { color: '#0C5A96' } },
    ],
};

const coldarkCold = {
    plain: {
        color: '#111b27',
        backgroundColor: '#e3eaf2',
    },
    styles: [
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#3c526d', fontStyle: 'italic' } },
        { types: ['punctuation'], style: { color: '#111b27' } },
        { types: ['tag', 'delimiter'], style: { color: '#006d6d' } },
        { types: ['attr-name', 'boolean', 'number', 'constant'], style: { color: '#755f00' } },
        { types: ['class-name', 'key', 'parameter', 'property', 'variable'], style: { color: '#005a8e' } },
        { types: ['string', 'attr-value', 'char', 'inserted'], style: { color: '#116b00' } },
        { types: ['builtin', 'regex'], style: { color: '#af00af' } },
        { types: ['function', 'selector'], style: { color: '#7c00aa' } },
        { types: ['keyword', 'operator', 'unit'], style: { color: '#a04900' } },
        { types: ['deleted', 'important'], style: { color: '#c22f2e' } },
    ],
};

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Route. Aggregate. Extend.',
    tagline: 'Kono is a lightweight API Gateway in Go — parallel fan-out, flexible aggregation, and zero configuration magic.',
    favicon: 'img/rabbt.svg',

    future: {
        v4: true,
    },

    url: 'https://your-docusaurus-site.example.com',
    baseUrl: '/konodocs',

    organizationName: 'starwalkn',
    projectName: 'konodocs',
    trailingSlash: false,

    onBrokenLinks: 'throw',

    i18n: {
        defaultLocale: 'en',
        locales: ['en'],
    },

    presets: [
        [
            'classic',
            /** @type {import('@docusaurus/preset-classic').Options} */
            ({
                docs: {
                    sidebarPath: './sidebars.js',
                },
                blog: false,
                theme: {
                    customCss: './src/css/custom.css',
                },
            }),
        ],
    ],

    themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
        ({
            image: 'img/docusaurus-social-card.jpg',
            colorMode: {
                defaultMode: 'light',
                disableSwitch: true,
                respectPrefersColorScheme: false,
            },
            announcementBar: {
                id: 'contributors',
                content: '✦  We are looking for active contributors',
                // CSS overrides background/text — these stay as safe defaults
                backgroundColor: '#EBF3FC',
                textColor: '#1A6FD4',
                isCloseable: true,
            },
            navbar: {
                title: 'Kono',
                logo: {
                    alt: 'Rabbit',
                    src: 'img/rabbt.svg',
                },
                items: [
                    {
                        type: 'docSidebar',
                        label: 'Documentation',
                        sidebarId: 'docsSidebar',
                        position: 'left',
                    },
                    {
                        href: 'https://github.com/starwalkn/kono/discussions',
                        label: 'Help',
                        position: 'left',
                    },
                    {
                        href: 'https://github.com/starwalkn/kono',
                        className: 'header-github-link',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'dark',
                logo: {
                    alt: 'Rabbit',
                    src: 'img/rabbt-dark.svg',
                    width: 120,
                    height: 120,
                    href: 'https://github.com/starwalkn/kono',
                },
                links: [
                    {
                        title: 'Docs',
                        items: [
                            {label: 'Introduction',   to: '/docs/intro'},
                            {label: 'Getting Started', to: '/docs/getting-started'},
                            {label: 'Configuration',  to: '/docs/configuration'},
                            {label: 'Metrics',        to: '/docs/metrics'},
                        ],
                    },
                    {
                        title: 'Community',
                        items: [
                            {
                                label: 'GitHub Discussions',
                                href: 'https://github.com/starwalkn/kono/discussions',
                            },
                            {
                                label: 'GitHub Issues',
                                href: 'https://github.com/starwalkn/kono/issues',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/starwalkn/kono',
                            },
                            {
                                label: 'Releases',
                                href: 'https://github.com/starwalkn/kono/releases',
                            },
                            {
                                label: 'pkg.go.dev',
                                href: 'https://pkg.go.dev/github.com/starwalkn/kono',
                            },
                            {
                                label: 'Docker Hub',
                                href: 'https://hub.docker.com/r/starwalkn/kono',
                            },
                        ],
                    },
                ],
                copyright: `Copyright © ${new Date().getFullYear()} Alexander Pikeev.<br/>Built with Docusaurus.`,
            },
            prism: {
                theme: duotoneSea,
                darkTheme: prismThemes.dracula,
                additionalLanguages: ['bash'],
            },
        }),
    plugins: [
        [
            '@easyops-cn/docusaurus-search-local',
            {
                hashed: true,
                language: 'en',
                highlightSearchTermsOnTargetPage: true,
                explicitSearchResultPath: true,
            },
        ],
    ],
};

export default config;