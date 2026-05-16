import clsx from 'clsx';
import styles from './styles.module.css';
import {Highlight} from 'prism-react-renderer';

const features = [
    {
        title: <>Fan-out & <span className={styles.gradientWord}>Aggregate</span></>,
        description: 'Dispatch a single request to multiple upstreams in parallel and combine their responses — merge JSON objects, wrap into an array, or namespace by upstream name.',
        code: `flows:
  - path: /api/summary/{user_id}
    upstreams:
      - hosts: http://users:8081
        method: GET
        path: /{user_id}/short
      - hosts: http://orders:8082
        method: POST
        path: /create
    aggregation:
      strategy: merge
      best_effort: true
      on_conflict:
        policy: prefer
        prefer_upstream: users`,
    },
    {
        title: <><span className={styles.gradientWord}>Resilient</span> by Default</>,
        description: 'Per-upstream circuit breaker, configurable retry with backoff, and load balancing across multiple hosts — out of the box, via YAML. No code required.',
        code: `policy:
  retry:
    max_retries: 3
    retry_on_statuses: [ 404, 409 ]
    backoff_delay: 500ms
  circuit_breaker:
    max_failures: 3
    reset_timeout: 10s
  load_balancing:
    mode: least_conns`,
        reverse: true,
    },
    {
        title: <>Extend with <span className={styles.gradientWord}>Plugins</span></>,
        description: 'Hook into request and response phases using dynamic .so plugins — modify headers, transform responses, validate tokens, or short-circuit requests.',
        code: `package main

import "github.com/starwalkn/kono/sdk"

type Plugin struct{}

func (p *Plugin) Info() sdk.PluginInfo {
    return sdk.PluginInfo{
        Name:    "snakeify",
        Version: "v1",
        Author:  "starwalkn",
    }
}

func (p *Plugin) Type() sdk.PluginType {
    return sdk.PluginTypeResponse
}

func (p *Plugin) Execute(ctx sdk.Context) error {
    // transform response JSON keys
    // to snake_case
    return snakeify(ctx.Response())
}`,
    },
];

const auroraTheme = {
    plain: {color: '#041E42', backgroundColor: 'transparent'},
    styles: [
        {types: ['keyword', 'builtin'],         style: {color: '#1A6FD4', fontWeight: 500}},
        {types: ['string', 'char'],             style: {color: '#0A5A9C'}},
        {types: ['function', 'method'],         style: {color: '#1050A0', fontWeight: 500}},
        {types: ['comment'],                    style: {color: '#7A9AB8', fontStyle: 'italic'}},
        {types: ['operator', 'punctuation'],    style: {color: '#5A7A9C'}},
        {types: ['class-name', 'type'],         style: {color: '#1A6FD4'}},
        {types: ['number', 'boolean'],          style: {color: '#0A5A9C'}},
        {types: ['attr-name', 'property'],      style: {color: '#1A6FD4'}},
        {types: ['attr-value', 'inserted'],     style: {color: '#0A5A9C'}},
        {types: ['tag', 'selector'],            style: {color: '#1A6FD4'}},
        {types: ['variable'],                   style: {color: '#2C6FAC'}},
        {types: ['regex', 'important'],         style: {color: '#0E4A95'}},
        {types: ['deleted'],                    style: {color: '#BF616A'}},
    ],
};

function Terminal({code, language = 'go'}) {
    return (
        <div className={styles.terminal}>
            <div className={styles.terminalDots}>
                <span/><span/><span/>
            </div>
            <Highlight code={code.trim()} language={language} theme={auroraTheme}>
                {({className, style, tokens, getLineProps, getTokenProps}) => (
                    <pre className={clsx(styles.terminalCode, className)} style={style}>
                        {tokens.map((line, i) => (
                            <div key={i} {...getLineProps({line})}>
                                {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({token})} />
                                ))}
                            </div>
                        ))}
                    </pre>
                )}
            </Highlight>
        </div>
    );
}

function Feature({title, description, code, reverse}) {
    return (
        <div className={clsx(styles.featureRow, reverse && styles.featureRowReverse)}>
            <div className={styles.featureText}>
                <h3 className={styles.featureTitle}>{title}</h3>
                <p className={styles.featureDesc}>{description}</p>
            </div>
            <Terminal code={code}/>
        </div>
    );
}

export default function HomepageFeatures() {
    return (
        <section className={clsx(styles.features, 'homepage-features')}>
            <div className="container">
                {features.map((props, idx) => (
                    <Feature key={idx} {...props} />
                ))}
            </div>
        </section>
    );
}