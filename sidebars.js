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
                {
                    type: 'category',
                    label: 'Configuration',
                    collapsed: true,
                    link: {type: 'doc', id: 'configuration/configuration'},
                    items: [
                        'configuration/configuration-server-admin',
                        'configuration/configuration-observability',
                        'configuration/configuration-routing-flows',
                        'configuration/configuration-upstreams',
                        'configuration/configuration-plugins-middlewares',
                    ],
                },
                'response-format',
                'streaming',
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
                {
                    type: 'category',
                    label: 'CLI',
                    collapsed: true,
                    link: {type: 'doc', id: 'cli/cli'},
                    items: [
                        'cli/cli-aastro',
                        'cli/cli-aastroctl',
                        'cli/cli-conventions',
                    ],
                },
            ],
        },
    ],
};

export default sidebars;