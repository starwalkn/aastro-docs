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

const coldarkDark = {
    plain: {
        color: '#e3eaf2',
        backgroundColor: '#111b27',
    },
    styles: [
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#8da1b9', fontStyle: 'italic' } },
        { types: ['punctuation'], style: { color: '#e3eaf2' } },
        { types: ['tag', 'delimiter'], style: { color: '#66cccc' } },
        { types: ['attr-name', 'boolean', 'number', 'constant'], style: { color: '#e6d37a' } },
        { types: ['class-name', 'key', 'parameter', 'property', 'variable'], style: { color: '#6cb8e6' } },
        { types: ['string', 'attr-value', 'char', 'inserted'], style: { color: '#91d076' } },
        { types: ['builtin', 'regex'], style: { color: '#f4adf4' } },
        { types: ['function', 'selector'], style: { color: '#c699e3' } },
        { types: ['keyword', 'operator', 'unit'], style: { color: '#e9ae7e' } },
        { types: ['deleted', 'important'], style: { color: '#cd6660' } },
    ],
};

const nord = {
    plain: {
        color: '#f8f8f2',
        backgroundColor: '#2E3440',
    },
    styles: [
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#636f88', fontStyle: 'italic' } },
        { types: ['punctuation', 'property', 'tag', 'constant', 'symbol', 'boolean', 'keyword', 'operator', 'variable'], style: { color: '#81A1C1' } },
        { types: ['number'], style: { color: '#B48EAD' } },
        { types: ['string', 'char', 'builtin', 'inserted', 'selector', 'attr-name'], style: { color: '#A3BE8C' } },
        { types: ['function', 'class-name', 'atrule', 'attr-value'], style: { color: '#88C0D0' } },
        { types: ['regex', 'important'], style: { color: '#EBCB8B' } },
        { types: ['deleted'], style: { color: '#BF616A' } },
    ],
};

/** @type {import('@docusaurus/types').Config} */
const config = {
    title: 'Route. Aggregate. Extend.',
    tagline: 'Kono is a lightweight API Gateway in Go — parallel fan-out, flexible aggregation, and zero configuration magic.',
    favicon: 'img/rabbit-origami-paper.svg',

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
                content: 'We are looking for active contributors',
                backgroundColor: '#1A6FD4',
                textColor: '#F0F4F8',
                isCloseable: true,
            },
            navbar: {
                title: 'Kono',
                logo: {
                    alt: 'Rabbit Origami Paper',
                    src: 'img/rabbit-origami-paper.svg',
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
                        type: 'docsVersionDropdown',
                        position: 'right',
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
                    alt: 'Rabbit Origami Paper',
                    src: 'img/rabbit-origami-paper.svg',
                    width: 70,
                    height: 70,
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
                theme: coldarkDark,
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