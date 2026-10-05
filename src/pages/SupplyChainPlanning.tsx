import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const SupplyChainPlanning = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner1.jpg"
        transparentText="Services"
        title={<><span>Kinaxis</span> Supply Chain Planning</>}
        breadcrumb="Kinaxis"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-80 pb-70 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Kinaxis Supply Chain Planning</h2>
                <p>Most supply chain problems are not really planning problems. They are visibility problems that only show up as planning problems — a demand signal nobody trusted, a constraint nobody modelled, a plan that was already out of date by the time it reached the people expected to act on it. Jobly helps organisations close that gap on <strong>Kinaxis</strong>, combining supply chain planning expertise with the staffing depth to keep the capability running long after go-live.</p>

                <div className="media mb-40 mb-md-35 mb-sm-30 mb-xs-25">
                  <img src="/assets/img/project-details/1a.webp" alt="Supply chain planning consulting" loading="lazy" decoding="async" />
                </div>

                <h5>What we plan</h5>
                <p>We work across the planning cycle rather than a single module, because the handoffs between them are usually where value leaks:</p>
                <ul>
                  <li><strong>Sales &amp; Operations Planning (S&amp;OP)</strong> — one agreed plan across commercial, supply and finance, with a cadence people actually keep.</li>
                  <li><strong>Demand planning and demand management</strong> — statistical baselines, consensus forecasting, and the discipline to measure forecast accuracy honestly.</li>
                  <li><strong>Supply planning</strong> — sourcing, replenishment and distribution plans that respect real lead times.</li>
                  <li><strong>Capacity and constraint management</strong> — modelling the bottleneck that actually governs output, not the one on the org chart.</li>
                  <li><strong>Master production scheduling</strong> — turning the plan into a sequence the plant can run.</li>
                  <li><strong>Inventory strategy</strong> — segmentation and buffer placement, so working capital sits where it absorbs variability.</li>
                </ul>

                <h5>Kinaxis implementation and support</h5>
                <p>Our planning work centres on <strong>Kinaxis</strong> — Maestro, and the RapidResponse deployments many organisations are still running. Kinaxis sits alongside the ERP you already have rather than replacing it, which is what makes concurrent planning practical: demand, supply and capacity are modelled together, so a change in one is reflected across the plan immediately instead of at the next planning cycle.</p>
                <p>We cover the full lifecycle rather than implementation alone:</p>
                <ul>
                  <li><strong>Implementation and deployment</strong> — configuration, workbook and scenario design, and go-live support</li>
                  <li><strong>Upgrades and release testing</strong> — including RapidResponse to Maestro transitions</li>
                  <li><strong>ERP and data integration</strong> — SAP, Oracle and others, plus the master data readiness work that decides whether the model is trustworthy</li>
                  <li><strong>Testing</strong> — configuration, integration and upgrade test strategy and execution</li>
                  <li><strong>Analytics and reporting</strong> on top of the planning data</li>
                  <li><strong>Application support</strong> and day-to-day planning operations</li>
                  <li><strong>Knowledge transfer</strong>, so your planners are not dependent on us</li>
                </ul>
                <p>Where an existing Kinaxis implementation has stalled or is not being used as intended, we also take on recovery and re-adoption work — usually a faster route to value than starting again.</p>

                <h5>Kinaxis Maestro</h5>
                <p>Maestro is the current generation of the platform, and what most new implementations are built on. We deliver end-to-end: solution design and configuration, scenario and workbook build, integration, testing, go-live and the application support that follows. For organisations already live, we also run post-go-live value realisation — measuring whether the planning process is actually delivering the forecast accuracy, service and inventory outcomes the business case assumed, and fixing it where it is not.</p>

                <h5>Kinaxis Planning One</h5>
                <p>Planning One is the pre-configured, cloud-native option aimed at mid-market organisations that need planning capability without a multi-year programme. It goes live in weeks rather than quarters, using templates and standard integrations rather than a bespoke build. We handle implementation and go-live, ERP data onboarding, user enablement and ongoing support — and, when the business outgrows it, the upgrade path onto Maestro.</p>

                <h5>Migrating from SAP APO or IBP, and from RapidResponse</h5>
                <p>Two migrations come up repeatedly. Organisations leaving <strong>SAP APO</strong> — long past end of mainstream maintenance — or weighing <strong>IBP</strong> against Kinaxis need the planning logic carried across rather than rebuilt from a blank sheet, which is where most of the risk and cost sits. Separately, existing <strong>RapidResponse</strong> estates need moving onto Maestro without losing years of accumulated configuration. We do both, starting with an assessment of what should be migrated, what should be retired, and what was never working in the first place.</p>

                <h5>Kinaxis health check</h5>
                <p>If you are already live and something is not right — plans nobody trusts, planners back in spreadsheets, an upgrade that keeps slipping — we will run a short review of the configuration, data quality and how the system is actually being used, and give you a written view of what is worth fixing and in what order. No obligation to engage us for the work that follows.</p>

                <h5>Support that does not disappear at go-live</h5>
                <p>Planning capability decays quietly. Parameters drift, the people who were trained move on, and within a year the organisation is back to spreadsheets alongside the system it paid for. We provide certified, experienced resources for day-to-day planning operations and application support — our staffing heritage is the reason we can sustain this rather than hand over a document and leave.</p>

                <h5>How we work</h5>
                <ul>
                  <li><strong>Assess.</strong> A short diagnostic on your current planning process, data quality and system setup — and a frank view of what is worth fixing first.</li>
                  <li><strong>Design.</strong> A target process and solution design agreed with the planners who will live with it, not written at them.</li>
                  <li><strong>Deliver.</strong> Build, integrate and test in increments, with named senior consultants who stay on the engagement.</li>
                  <li><strong>Sustain.</strong> Post go-live support, adoption measurement, and periodic reviews against the benefits the business case promised.</li>
                </ul>

                <h5>What good looks like</h5>
                <p>We would rather be measured on outcomes than on deliverables. The measures that matter in this work are usually forecast accuracy and bias, service level against promise, inventory turns and excess, planner time spent reconciling data versus deciding, and how quickly the organisation can replan when something breaks. We agree these at the start and report against them.</p>

                <h5>Why Jobly</h5>
                <p>Planning programmes fail for people reasons more often than technical ones — the wrong skills at the wrong moment, a key consultant swapped out mid-build, or no one left to run the process once the implementation team rolls off. Resourcing is what Jobly has always done. Pairing that with supply chain planning delivery means we can staff an engagement properly, keep the same team on it, and support the capability for as long as you need it.</p>
                <p>If you are planning a Kinaxis implementation, recovering one that has stalled, or simply want an honest assessment of what your current setup is capable of, we are happy to take a look.</p>

                {/* Nominative use: naming the platform we work on is fine, but
                    the mark belongs to Kinaxis and the page should say so. This
                    makes no claim of partnership, certification or endorsement —
                    add one only if it is genuinely held. */}
                <p className="font-la" style={{ fontSize: '13px', opacity: 0.7, marginTop: '28px' }}>
                  Kinaxis, Maestro and RapidResponse are trademarks of Kinaxis Inc. Jobly Solutions is an
                  independent services provider; references to these products describe the platforms we work
                  with and do not imply any affiliation with or endorsement by Kinaxis Inc.
                </p>
              </div>
            </div>

            <div className="col-xl-4">
              <ServiceSidebar
                active="/kinaxis"
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

export default SupplyChainPlanning;
