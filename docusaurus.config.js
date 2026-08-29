// @ts-check
import {themes as prismThemes} from 'prism-react-renderer';

const aastroCode = {
    plain: {
        color: '#0f141a',
        backgroundColor: '#EAF3FB',
    },
    styles: [
        // Quiet — comments recede rather than compete
        { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#5C7691', fontStyle: 'italic' } },
        // Violet — control flow (keywords, operators, tags)
        { types: ['keyword', 'tag', 'operator'], style: { color: '#6B4FA3' } },
        // Amber — literal string values, the warm counterweight to the blue background
        { types: ['string', 'attr-value', 'char'], style: { color: '#B45A12' } },
        // Deep navy — function and type names, distinct from the brighter brand blue below
        { types: ['function', 'class-name'], style: { color: '#0B4A85' } },
        // Teal — numeric and boolean literals
        { types: ['number', 'boolean', 'constant'], style: { color: '#0E7D6B' } },
        // Neutral slate — structural punctuation stays out of the way
        { types: ['punctuation'], style: { color: '#51697F' } },
        // Brand blue — reserved for the token readers scan for most: YAML/JSON keys.
        // Prism's YAML grammar tags keys as `key` aliased to `atrule`, so both must
        // resolve to this same rule or the alias silently wins with the wrong color.
        { types: ['variable', 'property', 'key', 'atrule'], style: { color: '#1A6FD4' } },
        // Muted magenta-violet — builtins only (e.g. bash/go builtin functions)
        { types: ['builtin'], style: { color: '#8452A8' } },
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
    title: 'Aastro Documentation',
    tagline: 'Aastro (Åstro) is a lightweight API Gateway in Go — parallel fan-out, flexible aggregation, and zero configuration magic.',
    favicon: 'img/rabbt.svg',
    future: {
        v4: true,
    },

    url: 'https://your-docusaurus-site.example.com',
    baseUrl: '/aastro-docs',

    organizationName: 'starwalkn',
    projectName: 'aastro-docs',
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
              id: 'topbar',
              content:
                '<span class="topbar-left"><a href="https://github.com/starwalkn/aastro/releases">v0.9.0</a></span>' +
                '<a href="mailto:alexanderpikeev@gmail.com">Contact us</a>',
              backgroundColor: '#0f141a',
              textColor: '#ffffff',
              isCloseable: false,
            },
            navbar: {
                title: 'Aastro',
                logo: {
                    alt: 'Aastro',
                    src: 'img/aastro.svg',
                },
                items: [
                    {
                        type: 'docSidebar',
                        label: 'Documentation',
                        sidebarId: 'docsSidebar',
                        position: 'left',
                    },
                    {
                        href: 'https://github.com/starwalkn/aastro/discussions',
                        label: 'Help',
                        position: 'left',
                    },
                    {
                        href: 'https://github.com/starwalkn/aastro',
                        className: 'header-github-link',
                        position: 'right',
                    },
                ],
            },
            footer: {
                style: 'dark',
                logo: {
                    alt: 'Aastro Dark',
                    src: 'img/aastro-dark.svg',
                    width: 120,
                    height: 120,
                    href: 'https://github.com/starwalkn/aastro',
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
                                href: 'https://github.com/starwalkn/aastro/discussions',
                            },
                            {
                                label: 'GitHub Issues',
                                href: 'https://github.com/starwalkn/aastro/issues',
                            },
                        ],
                    },
                    {
                        title: 'More',
                        items: [
                            {
                                label: 'GitHub',
                                href: 'https://github.com/starwalkn/aastro',
                            },
                            {
                                label: 'Releases',
                                href: 'https://github.com/starwalkn/aastro/releases',
                            },
                            {
                                label: 'pkg.go.dev',
                                href: 'https://pkg.go.dev/github.com/starwalkn/aastro',
                            },
                            {
                                label: 'Docker Hub',
                                href: 'https://hub.docker.com/r/starwalkn/aastro',
                            },
                        ],
                    },
                ],
                copyright: `Copyright © ${new Date().getFullYear()} Alexander Pikeev.<br/>Built with Docusaurus.`,
            },
            prism: {
                theme: aastroCode,
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