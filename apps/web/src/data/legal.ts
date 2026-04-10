export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  lastUpdated: string;
  content: string;
};

export const legalDocuments: LegalDocument[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    description:
      "The terms and conditions governing use of the Brimble platform, APIs, and related services.",
    lastUpdated: "March 2026",
    content: `These Terms of Service ("Terms") govern access to and use of the services provided by Brimble Inc. ("Brimble", "we", "our", or "us").

Brimble Inc
447 Broadway, 2nd Floor #332
New York, NY 10013
United States

Website: brimble.io
Support: support@brimble.app

By accessing or using the Brimble platform, APIs, or related services (collectively, the "Services"), you agree to be bound by these Terms.

If you do not agree with these Terms, you must not use the Services.

---

## 1. Description of Services
Brimble provides a developer cloud platform that enables individuals and organizations to build, deploy, host, and operate software applications and infrastructure.

Services may include:
- Application hosting
- Container deployment
- Database infrastructure
- AI model access
- API services
- Monitoring and logging tools
- Object storage
- Developer tooling

Brimble may modify or discontinue features at any time.

## 2. Eligibility
You must be at least 18 years old and legally capable of entering contracts to use the Services.
If you use Brimble on behalf of an organization, you represent that you have authority to bind that organization to these Terms.

## 3. Accounts and Authentication
Access to certain features requires account registration.
Users may authenticate through:
- Email-based authentication
- Magic links
- Third-party identity providers such as Google or GitHub

You are responsible for:
- Maintaining account confidentiality
- Securing credentials
- All activity under your account

Brimble is not responsible for losses resulting from compromised credentials.

## 4. Developer Responsibilities
Brimble provides infrastructure tools but does not control how users deploy applications.
Users are solely responsible for:
- The content of deployed applications
- Compliance with laws and regulations
- Security of application code
- Protection of credentials and API keys

Brimble does not review or monitor application code by default.

## 5. Acceptable Use
Users must comply with the Brimble Acceptable Use Policy.
Prohibited activities include:
- Hosting malware
- Conducting cyberattacks
- Operating botnets
- Illegal content distribution
- Infrastructure abuse

Brimble reserves the right to suspend or terminate accounts violating these policies.

## 6. Payments and Billing
Some features require payment.
Payments are processed through third-party providers.
Users agree to:
- Pay all applicable fees
- Maintain valid payment methods
- Allow recurring billing when applicable

Fees are generally non-refundable except where required by law.

## 7. Infrastructure Providers
Brimble operates using third-party infrastructure providers including cloud computing, networking, and database providers.
Service availability may depend on external providers.
Brimble is not liable for failures caused by third-party infrastructure providers.

## 8. AI Services
Brimble may provide access to artificial intelligence models.
AI outputs:
- may be inaccurate
- may reflect limitations of the underlying model
- should not be treated as professional advice

Users are responsible for evaluating AI outputs.

## 9. Intellectual Property
The Brimble platform, software, branding, and documentation are owned by Brimble Inc.
Users retain ownership of code and content they upload.
Users grant Brimble a limited license to host and process such content solely for providing the Services.

## 10. Service Availability
Brimble strives for reliable service but does not guarantee uninterrupted availability.
Downtime may occur due to:
- infrastructure maintenance
- network failures
- third-party outages
- software updates

## 11. Limitation of Liability
To the maximum extent permitted by law, Brimble Inc will not be liable for:
- indirect damages
- lost profits
- loss of data
- business interruptions

Brimble's total liability will not exceed the amount paid by the user for services during the preceding 12 months.

## 12. Termination
Brimble may suspend or terminate accounts if users:
- violate these Terms
- abuse infrastructure
- pose security risks

Users may stop using the Services at any time.

## 13. Arbitration Agreement
Any disputes arising from these Terms shall be resolved through binding arbitration rather than court proceedings, except where prohibited by law.
Arbitration shall occur in accordance with applicable arbitration rules in the United States.

## 14. Governing Law
These Terms are governed by the laws of the State of Delaware, United States.

## 15. Changes to Terms
Brimble may update these Terms periodically.
Continued use of the Services after updates constitutes acceptance of revised Terms.

## 16. Contact
Legal inquiries may be directed to: legal@brimble.app`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description:
      "How Brimble collects, uses, and safeguards your personal data and information.",
    lastUpdated: "March 2026",
    content: `Brimble Inc ("Brimble", "we", "our", or "us") respects your privacy and is committed to protecting personal data.
This Privacy Policy explains how we collect, use, and safeguard information.

## 1. Information We Collect
Account Information: Name, Email address, Organization details
Usage Data: API requests, deployment activity, feature usage
Technical Information: IP address, device information, browser information
Billing Information: Payments are processed through third-party payment providers. Brimble does not store full payment card numbers.

## 2. How We Use Information
Information may be used to: operate the platform, authenticate users, process payments, provide customer support, improve services, monitor system performance, ensure security

## 3. Cookies and Tracking
Brimble may use cookies and similar technologies to: authenticate sessions, remember preferences, analyze usage patterns
This includes PostHog for product analytics, feature usage measurement, and product improvement.
Depending on context, PostHog may process pseudonymous identifiers, page URLs, interaction events, browser/device metadata, and session replay data with masking controls.
Users may disable cookies in their browser settings.

## 4. Third-Party Services
Brimble relies on external service providers for infrastructure and operations. These providers may process limited data necessary to deliver services.
This includes analytics providers such as PostHog.

## 5. Data Security
Brimble implements reasonable security measures including: encrypted communications, access controls, monitoring systems, security incident response procedures
No system can guarantee absolute security.

## 6. Data Retention
Data is retained only as long as necessary to operate the platform or comply with legal obligations. Users may request deletion of personal data where applicable.

## 7. International Data Transfers
Brimble operates globally. Data may be processed in multiple jurisdictions depending on infrastructure providers. Brimble takes reasonable steps to ensure appropriate safeguards.

## 8. User Rights
Depending on jurisdiction, users may have rights to: access their data, request corrections, request deletion
Requests may be submitted through support channels.

## 9. Children's Privacy
Brimble services are not directed toward individuals under the age of 18.

## 10. Changes to This Policy
We may update this Privacy Policy periodically. Updated versions will be published on the website.

## 11. Contact
privacy@brimble.app`,
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    description:
      "Prohibited activities and usage guidelines for the Brimble platform.",
    lastUpdated: "March 2026",
    content: `This Acceptable Use Policy defines prohibited activities when using the Brimble platform.

## 1. Illegal Activities
Users may not use Brimble to engage in unlawful conduct including: fraud, identity theft, copyright infringement, illegal marketplaces

## 2. Security Violations
Users may not attempt to compromise system integrity including: hacking attempts, denial-of-service attacks, network scanning, exploitation of vulnerabilities

## 3. Infrastructure Abuse
Prohibited activities include: unauthorized cryptocurrency mining, resource exhaustion attacks, automated abuse of APIs

## 4. Malware Distribution
Brimble may not be used to distribute: malware, ransomware, spyware, viruses

## 5. Phishing and Spam
Users may not operate: phishing campaigns, spam operations, deceptive marketing systems

## 6. Enforcement
Brimble reserves the right to investigate violations and suspend accounts where necessary.`,
  },
  {
    slug: "security",
    title: "Security",
    description:
      "An overview of the security measures and practices used to protect the Brimble platform.",
    lastUpdated: "March 2026",
    content: `Security is a core priority for Brimble. This document describes the security measures used to protect the platform.

## Infrastructure Security
Brimble operates on cloud infrastructure providers with secure data centers.
Security features include: physical access controls, redundant power, surveillance monitoring, environmental safeguards

## Network Security
Measures include: encrypted traffic (TLS), firewall protections, network isolation, DDoS mitigation

## Access Controls
Internal access to systems is restricted using: multi-factor authentication, role-based permissions, audit logging

## Monitoring
Brimble continuously monitors systems for abnormal activity.
Monitoring includes: system logs, performance metrics, automated alerts

## Incident Response
In the event of a security incident, Brimble will: investigate the issue, contain affected systems, notify impacted users where appropriate

## Responsible Disclosure
Security researchers may report vulnerabilities to: security@brimble.app`,
  },
  {
    slug: "data-processing",
    title: "Data Processing Agreement",
    description:
      "The agreement governing how Brimble processes data on behalf of its customers.",
    lastUpdated: "March 2026",
    content: `This Data Processing Agreement ("DPA") forms part of the agreement between Brimble Inc and its customers.

## 1. Roles
Customer acts as the data controller. Brimble acts as the data processor.

## 2. Scope of Processing
Brimble processes data solely for the purpose of providing cloud infrastructure services.

## 3. Security Measures
Brimble implements security measures including: encryption in transit, access control policies, monitoring systems

## 4. Sub-processors
Brimble may engage approved sub-processors. A list is available on the Brimble Sub-processors page.

## 5. Data Breach Notification
Brimble will notify customers without undue delay after confirming a breach affecting customer data.

## 6. Data Retention and Deletion
Customer data will be deleted when services are terminated unless retention is legally required.

## 7. International Transfers
Data may be processed in multiple jurisdictions depending on infrastructure providers.

## 8. Contact
legal@brimble.app`,
  },
  {
    slug: "subprocessors",
    title: "Sub-processors",
    description:
      "A list of third-party service providers that Brimble relies on to operate and deliver the platform.",
    lastUpdated: "March 2026",
    content: `Brimble Inc. ("Brimble", "we", "our", or "us") relies on certain third-party service providers ("Sub-processors") to operate and deliver the Brimble platform.

## 1. Overview
These providers assist with infrastructure hosting, monitoring, analytics, email delivery, payments, content delivery, and other operational services. Sub-processors may process limited customer data only as necessary. Brimble carefully selects vendors that maintain strong security and privacy practices.

## 2. Infrastructure Providers
### Hetzner
Purpose: Cloud infrastructure and compute hosting.
Data Processed: Application workloads, networking traffic, and infrastructure metadata.

### DigitalOcean
Purpose: Cloud infrastructure services and compute resources.
Data Processed: Application hosting environments and infrastructure metrics.

### ScaleGrid
Purpose: Managed database infrastructure and database operations.
Data Processed: Database workloads, database metadata, and operational metrics.

## 3. Content Delivery and Networking
### Cloudflare
Purpose: CDN, DNS management, caching, and security services including traffic filtering and DDoS mitigation.
Data Processed: IP addresses, request metadata, and network traffic information.

## 4. Object Storage
### Tigris
Purpose: Object storage services for files, assets, and user-generated storage.
Data Processed: Stored files and associated storage metadata.

## 5. Monitoring and Logging
### Better Stack
Purpose: System monitoring, logging, alerting, and incident detection.
Data Processed: Application logs, infrastructure logs, and performance metrics.

### Google Cloud Uptime Monitoring
Purpose: External uptime monitoring of Brimble services.
Data Processed: Service availability metrics and monitoring results.

### Laravel Nightwatch
Purpose: Application monitoring for PHP-based workloads.
Data Processed: Application performance metrics and debugging information.

## 6. Analytics
### PostHog
Purpose: Product analytics and platform usage insights.
Data Processed: Usage analytics, feature interaction data, pseudonymous identifiers, page and event metadata, and session replay data with masking controls.

## 7. AI Model Providers
### Together AI
Purpose: AI model infrastructure and inference services.
Data Processed: Model prompts, input data, and generated output processed through AI APIs.

## 8. Email Delivery
### Resend
Purpose: Transactional email delivery including account notifications, authentication emails, and platform alerts.
Data Processed: Email addresses and email content required to deliver messages.

## 9. Payment Processing
### Stripe
Purpose: Global payment processing and subscription management.
Data Processed: Payment information, billing data, and transaction metadata.

### Paystack
Purpose: Payment processing for supported regions.
Data Processed: Payment details, billing data, and transaction information.

## 10. Development Infrastructure
### GitHub
Purpose: Source code hosting, version control, and development collaboration.
Data Processed: Code repositories, commit history, and development metadata.

### Docker Hub
Purpose: Container image registry used to distribute and manage application containers.
Data Processed: Container images and metadata.

## 11. Authentication Providers
External login providers may include: Google Login, GitHub Login
These providers process authentication requests and identity verification data.

## 12. Sub-processor Updates
Brimble may update this list periodically as new service providers are added or removed.

## 13. Contact
Questions regarding sub-processors: privacy@brimble.app`,
  },
];
