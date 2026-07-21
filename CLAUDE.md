# Skill: Build Trusted Worker Marketplace

## Purpose

You are an expert product architect and full-stack engineer helping build a marketplace for programmable services ("Workers").

The platform allows developers to publish AI agents, APIs, automation tools, and other programmable services. Users discover services by task, pay through escrow, and receive results. The platform provides verification, benchmarking, reputation, and trust scoring.

Do not treat this as only an AI agent marketplace. Workers can be:

* AI agents
* APIs
* Data services
* Scrapers
* Automation tools
* Blockchain tools
* Developer utilities
* Any programmable service with structured input/output

---

# Core Product Vision

Build:

> A trusted marketplace for programmable workers where developers publish services, users pay for completed outcomes, and every worker has transparent benchmarks, reputation, and verification.

The platform should be similar in spirit to:

* App Store (discovery + trust)
* RapidAPI (developer services)
* Fiverr (task marketplace)
* Steam (ratings + reputation)
* Cloud marketplaces (service publishing)

---

# Core Concepts

## Worker

A Worker is a programmable service.

Examples:

* Solidity Auditor
* Wallet Risk Analyzer
* Web Scraper
* PDF Processor
* Research Agent
* Image Processor
* Data Extraction Tool

Workers expose a standard interface.

---

# Worker Manifest

Every worker must provide a JSON manifest.

The manifest is the source of truth for:

* identity
* inputs
* outputs
* pricing
* permissions
* verification
* privacy

Example structure:

```json
{
  "name": "",
  "version": "",
  "category": "",

  "description": "",

  "endpoint": {
    "url": "",
    "method": "POST",
    "timeout_seconds": 60
  },

  "input": {},
  "output": {},

  "pricing": {},

  "trial": {
    "free_runs": 3
  },

  "privacy": {},

  "capabilities": [],

  "verification": {}
}
```

Use JSON everywhere.

Avoid YAML.

---

# Developer Publishing Flow

Developer submits:

1. Worker manifest JSON
2. README
3. API documentation
4. Example inputs
5. Example outputs
6. Pricing model
7. Privacy declaration
8. Version information
9. Changelog

---

# Input / Output Schema

Every worker must define:

* accepted inputs
* required fields
* field types
* validation rules
* output format

The platform should automatically generate:

* UI forms
* API documentation
* test cases
* benchmark inputs

---

# Verification System

Build internal platform agents.

These are not user-facing workers.

They evaluate submitted workers.

---

## Documentation Agent

Checks:

* README quality
* missing information
* unrealistic claims
* privacy inconsistencies
* incomplete documentation

Output:

```json
{
  "score": 0-100,
  "issues": []
}
```

---

## Security Agent

Checks:

* suspicious behavior
* endpoint safety
* prompt injection resistance
* data leakage risks
* credential exposure

Never automatically ban.

Only flag.

---

## Benchmark Agent

Runs standardized tests.

Examples:

Smart Contract Auditor:

* known vulnerable contracts
* safe contracts
* tricky cases

Measures:

* accuracy
* false positives
* false negatives
* explanation quality
* latency
* cost

---

## Judge Agent

Combines:

* documentation score
* security score
* benchmark score
* reliability
* user feedback

Creates final reputation score.

---

# Trust Score

Every worker should have:

```
Trust Score: 0-100
```

Possible weighting:

* Benchmark performance
* User ratings
* Completion rate
* Refund rate
* Reliability
* Developer verification

Never rely only on AI judgement.

---

# Payment System

Support:

* Stripe
* Crypto payments
* USDC

Use escrow.

Flow:

```
User pays
    |
    v
Escrow
    |
    v
Worker executes
    |
    v
Result delivered
    |
    v
Payment released
```

---

# Outcome Policies

Workers define acceptable outcomes.

Examples:

## Friendly

* 3 retries
* full refund

## Standard

* retry + partial refund

## Strict

* limited refund

Platform always refunds automatically for:

* API unavailable
* timeout
* invalid response
* server failure

---

# Reputation

Do not only use stars.

Track:

```
Rating

Successful jobs

Acceptance rate

Refund rate

Average latency

Average cost

Benchmark score

Version history
```

---

# Long-Term Architecture

Start:

Developer-hosted APIs.

Future:

Marketplace-hosted execution.

Future runtime should support:

* sandboxing
* permissions
* no logging mode
* restricted network access
* secure execution

---

# Development Principles

Always prioritize:

1. Trust
2. Developer experience
3. User safety
4. Transparent scoring
5. Easy onboarding

Do not build:

* generic AI wrappers
* prompt marketplaces
* empty agent directories

Workers must solve real problems.

---

# When implementing features

Always ask:

1. Does this increase user trust?
2. Does this help developers get discovered?
3. Can this be automated?
4. Can this be measured?
5. Can this scale?

---

# Preferred MVP

Build:

* Developer accounts
* Worker registration
* JSON manifest system
* Worker API testing
* Generated UI from schemas
* Benchmark pipeline
* Trust score
* Reviews
* Escrow payments
* Marketplace search