// @ts-check

/**
 * @type {import('@docusaurus/plugin-content-docs').SidebarsConfig}
 */
const sidebars = {
    docsSidebar: [
        'intro',
        'getting-started',
        {
            type: 'category',
            label: 'Core Concepts',
            collapsed: true,
            items: [
                'configuration',
                'response-format',
                'passthrough',
            ],
        },
        {
            type: 'category',
            label: 'Observability',
            collapsed: true,
            items: [
                'metrics',
                'tracing',
            ],
        },
        {
            type: 'category',
            label: 'Extending Aastro',
            collapsed: true,
            items: [
                'plugin-development',
                'builtins',
            ],
        },
        {
            type: 'category',
            label: 'Reference',
            collapsed: true,
            items: [
                'cli',
            ],
        },
    ],
};

export default sidebars;