"use strict";(self.webpackChunkaastrodocs=self.webpackChunkaastrodocs||[]).push([["823"],{4159(e,s,t){t.r(s),t.d(s,{default:()=>f});var r=t(4848),a=t(5310),n=t(898),l=t(816),o=t(2072),i=t(4164);let c="gradientWord_iPR7";var d=t(1765);let u=[{title:(0,r.jsxs)(r.Fragment,{children:["Fan-out & ",(0,r.jsx)("span",{className:c,children:"Aggregate"})]}),description:"Dispatch a single request to multiple upstreams in parallel and combine their responses \u2014 merge JSON objects, wrap into an array, or namespace by upstream name.",code:`flows:
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
        prefer_upstream: users`},{title:(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)("span",{className:c,children:"Resilient"})," by Default"]}),description:"Per-upstream circuit breaker, configurable retry with backoff, and load balancing across multiple hosts \u2014 out of the box, via YAML. No code required.",code:`policy:
  retry:
    max_retries: 3
    retry_on_statuses: [ 404, 409 ]
    backoff_delay: 500ms
  circuit_breaker:
    max_failures: 3
    reset_timeout: 10s
  load_balancing:
    mode: least_conns`,reverse:!0},{title:(0,r.jsxs)(r.Fragment,{children:["Extend with ",(0,r.jsx)("span",{className:c,children:"Plugins"})]}),description:"Hook into request and response phases using dynamic .so plugins \u2014 modify headers, transform responses, validate tokens, or short-circuit requests.",code:`package main

import "github.com/starwalkn/aastro/sdk"

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
}`}],p={plain:{color:"#041E42",backgroundColor:"transparent"},styles:[{types:["keyword","builtin"],style:{color:"#1A6FD4",fontWeight:500}},{types:["string","char"],style:{color:"#0A5A9C"}},{types:["function","method"],style:{color:"#1050A0",fontWeight:500}},{types:["comment"],style:{color:"#7A9AB8",fontStyle:"italic"}},{types:["operator","punctuation"],style:{color:"#5A7A9C"}},{types:["class-name","type"],style:{color:"#1A6FD4"}},{types:["number","boolean"],style:{color:"#0A5A9C"}},{types:["attr-name","property"],style:{color:"#1A6FD4"}},{types:["attr-value","inserted"],style:{color:"#0A5A9C"}},{types:["tag","selector"],style:{color:"#1A6FD4"}},{types:["variable"],style:{color:"#2C6FAC"}},{types:["regex","important"],style:{color:"#0E4A95"}},{types:["deleted"],style:{color:"#BF616A"}}]};function h({code:e,language:s="go"}){return(0,r.jsxs)("div",{className:"terminal_cT2d",children:[(0,r.jsxs)("div",{className:"terminalDots_kTyA",children:[(0,r.jsx)("span",{}),(0,r.jsx)("span",{}),(0,r.jsx)("span",{})]}),(0,r.jsx)(d.f4,{code:e.trim(),language:s,theme:p,children:({className:e,style:s,tokens:t,getLineProps:a,getTokenProps:n})=>(0,r.jsx)("pre",{className:(0,i.A)("terminalCode_r6kU",e),style:s,children:t.map((e,s)=>(0,r.jsx)("div",{...a({line:e}),children:e.map((e,s)=>(0,r.jsx)("span",{...n({token:e})},s))},s))})})]})}function m({title:e,description:s,code:t,reverse:a}){return(0,r.jsxs)("div",{className:(0,i.A)("featureRow_DEue",a&&"featureRowReverse_Z3JB"),children:[(0,r.jsxs)("div",{className:"featureText_ZxAV",children:[(0,r.jsx)("h3",{className:"featureTitle_L1YZ",children:e}),(0,r.jsx)("p",{className:"featureDesc_qOCZ",children:s})]}),(0,r.jsx)(h,{code:t})]})}function y(){return(0,r.jsx)("section",{className:(0,i.A)("features_t9lD","homepage-features"),children:(0,r.jsx)("div",{className:"container",children:u.map((e,s)=>(0,r.jsx)(m,{...e},s))})})}function g(){return(0,r.jsxs)(a.A,{className:"hero-badge",href:"https://github.com/starwalkn/aastro/releases",children:[(0,r.jsx)("span",{className:"hero-badge__sparkle",children:"\u2726"}),(0,r.jsxs)("span",{children:[(0,r.jsx)("strong",{children:"0.5.0"}),"\xa0just released"]}),(0,r.jsx)("span",{className:"hero-badge__sep",children:"\u2014"}),(0,r.jsx)("span",{children:"see what's new"}),(0,r.jsx)("span",{className:"hero-badge__arrow",children:"\u2192"})]})}function x(){let{siteConfig:e}=(0,n.A)();return(0,r.jsx)("header",{className:"hero",children:(0,r.jsxs)("div",{className:"container",children:[(0,r.jsx)(g,{}),(0,r.jsx)(o.A,{as:"h1",className:"hero__title",children:e.title}),(0,r.jsx)("p",{className:"hero__subtitle",children:e.tagline}),(0,r.jsxs)("div",{className:"hero-buttons",children:[(0,r.jsxs)(a.A,{className:"button button--secondary button--lg",to:"/docs/getting-started",children:["Getting Started ",(0,r.jsx)("span",{className:"arrow",children:"\u2192"})]}),(0,r.jsx)(a.A,{className:"button button--secondary button--lg",href:"https://github.com/starwalkn/aastro",children:"GitHub"})]})]})})}function f(){let{siteConfig:e}=(0,n.A)();return(0,r.jsxs)(l.A,{title:e.title,description:e.tagline,children:[(0,r.jsx)(x,{}),(0,r.jsx)("main",{children:(0,r.jsx)(y,{})})]})}}}]);