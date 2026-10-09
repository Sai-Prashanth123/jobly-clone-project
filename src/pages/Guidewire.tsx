import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const Guidewire = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner1.jpg"
        transparentText="Services"
        title={<><span>Guidewire</span> Data &amp; Delivery</>}
        breadcrumb="Guidewire"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-80 pb-70 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Guidewire Data &amp; Delivery</h2>
                <p>Most property &amp; casualty insurers running <strong>Guidewire</strong> have the same complaint, and it is rarely about the core system itself. PolicyCenter, ClaimCenter and BillingCenter do their job. The difficulty is getting trustworthy, timely data <em>out</em> of them — into the hands of actuaries, underwriters, claims leadership and the regulator — without a reporting layer that takes a day to refresh and disagrees with itself.</p>
                <p>Jobly works on both sides of that problem: the delivery and support of the core applications, and the data platform that sits downstream of them.</p>

                <div className="media mb-40 mb-md-35 mb-sm-30 mb-xs-25">
                  <img src="/assets/img/project-details/1c.webp" alt="Guidewire data and delivery consulting" loading="lazy" decoding="async" />
                </div>

                <h5>Guidewire Cloud Data Access and the analytics layer</h5>
                <p>Guidewire <strong>Cloud Data Access (CDA)</strong> publishes core system data out to your own cloud storage. That is the beginning of the work, not the end of it: what lands is change-data in a shape built for faithfulness, not for querying. Turning it into something an actuary can rely on means designing the layers in between.</p>
                <p>We build that pipeline as a layered architecture — raw landing, a cleaned and conformed middle layer, and curated business tables — so every figure can be traced back to the record that produced it:</p>
                <ul>
                  <li><strong>Ingestion</strong> from CDA into the lake, with full change history retained rather than overwritten</li>
                  <li><strong>Conformed layer</strong> — typed, deduplicated and reconciled across PolicyCenter, ClaimCenter and BillingCenter</li>
                  <li><strong>Curated models</strong> for the questions actually being asked: loss ratio, reserve development, claim cycle time, written and earned premium</li>
                  <li><strong>Incremental refresh</strong>, so reporting reflects today rather than last night</li>
                  <li><strong>Lineage and reconciliation</strong> back to the core system, because an actuarial number nobody can trace is a number nobody will sign off</li>
                </ul>
                <p>We work with Databricks and the major cloud data platforms, and with <strong>Guidewire Data Hub and InfoCenter</strong> where those are already in place. The same engineering discipline behind our Kinaxis work applies here — the domain differs, the problem of making a core system's data trustworthy does not.</p>

                <h5>Core application delivery and support</h5>
                <p>Alongside the data work we staff and support the applications themselves:</p>
                <ul>
                  <li><strong>PolicyCenter, ClaimCenter and BillingCenter</strong> configuration and integration</li>
                  <li><strong>Upgrades and cloud migration</strong>, including moving off heavily customised on-premise installs</li>
                  <li><strong>Integration</strong> with rating, document generation, payments, reinsurance and third-party data</li>
                  <li><strong>Testing</strong> — configuration, integration and regression suites that survive an upgrade</li>
                  <li><strong>Managed support</strong> for day-to-day operations after go-live</li>
                </ul>

                <h5>Why insurers come to us</h5>
                <p>Guidewire programmes are long, and the scarce resource is almost never the licence — it is people who have done it before and will still be there in month fourteen. Resourcing is what Jobly has always done. Pairing that with delivery capability means we can staff an engagement properly, keep the same team on it, and support the result for as long as you need rather than handing over documentation and leaving.</p>
                <p>We would rather be measured on outcomes than deliverables: how quickly reporting refreshes, whether finance and actuarial agree on the same number, how long a claims or policy change takes to reach production, and how much of the team's week goes on reconciliation instead of analysis. We agree those at the start and report against them.</p>

                <h5>Where to start</h5>
                <p>If your CDA extract is landing but nobody trusts what is built on it, or an upgrade keeps slipping, or you simply need experienced Guidewire people on a programme that is already running, we are happy to take a look and tell you honestly what we think.</p>

                {/* Nominative use: naming the platform we work on is fine, but the
                    mark belongs to Guidewire. No claim of partnership or
                    certification is made here — add one only if genuinely held. */}
                <p className="font-la" style={{ fontSize: '13px', opacity: 0.7, marginTop: '28px' }}>
                  Guidewire, InsuranceSuite, PolicyCenter, ClaimCenter, BillingCenter, Cloud Data Access, Data Hub
                  and InfoCenter are trademarks of Guidewire Software, Inc. Jobly Solutions is an independent
                  services provider; references to these products describe the platforms we work with and do not
                  imply any affiliation with or endorsement by Guidewire Software, Inc.
                </p>
              </div>
            </div>

            <div className="col-xl-4">
              <ServiceSidebar
                active="/guidewire"
                haveAnyImg="/assets/img/services-details/have-any.png"
              />
            </div>
          </div>
        </div>
      </section>
      {/* services-details end */}
    </PageLayout>
  );
};

export default Guidewire;
