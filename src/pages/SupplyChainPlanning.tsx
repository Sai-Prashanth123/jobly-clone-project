import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const SupplyChainPlanning = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner1.jpg"
        transparentText="Services"
        title={<>Supply Chain <span>Planning</span></>}
        breadcrumb="Supply Chain Planning"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-80 pb-70 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Supply Chain Planning</h2>
                <p>Most supply chain problems are not really planning problems. They are visibility problems that only show up as planning problems — a demand signal nobody trusted, a constraint nobody modelled, a plan that was already out of date by the time it reached the people expected to act on it. Jobly helps organisations close that gap, combining supply chain planning expertise with the staffing depth to keep the capability running long after go-live.</p>

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

                <h5>Implementation and platform work</h5>
                <p>We implement, configure and support planning platforms, and we integrate them with the ERP you already run rather than asking you to replace it. Our teams cover configuration and deployment, upgrades and release testing, and the data integration work that decides whether any of it survives contact with reality.</p>
                <ul>
                  <li>Platform configuration, deployment and upgrade delivery</li>
                  <li>ERP and data integration, including master data readiness</li>
                  <li>Test strategy and execution across configuration, integration and upgrades</li>
                  <li>Reporting and analytics on top of the planning data</li>
                  <li>Knowledge transfer, so your planners are not dependent on us</li>
                </ul>

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
                <p>If you are planning an implementation, recovering one that has stalled, or simply want an honest assessment of what your current setup is capable of, we are happy to take a look.</p>
              </div>
            </div>

            <div className="col-xl-4">
              <ServiceSidebar
                active="/supply-chain-planning"
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
