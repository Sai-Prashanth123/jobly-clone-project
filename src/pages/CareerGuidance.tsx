import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const faqs = [
  { id: 'faq-1', q: 'Industry-Aligned Workforce Strategy', a: 'Our consultants build talent roadmaps tied directly to your business goals — from headcount planning to workforce mix modeling for full-time, contract, and vendor talent.', defaultOpen: true },
  { id: 'faq-2', q: 'End-to-End Talent Acquisition Advisory', a: 'We help you stand up scalable hiring engines — sourcing channels, interview loops, employer branding, and recruiter enablement — so you fill critical roles faster without sacrificing quality.', defaultOpen: false },
  { id: 'faq-3', q: 'Compliance & Visa Advisory', a: 'Our team supports H-1B, L-1, OPT/CPT, E-Verify and I-9 compliance workflows so your global workforce stays audit-ready and your contracts stay enforceable.', defaultOpen: false },
  { id: 'faq-4', q: 'Process & Tooling Optimization', a: 'We audit your ATS, HRIS and timesheet/billing stack, eliminate friction across the hire-to-retire lifecycle, and roll out automations that cut admin overhead.', defaultOpen: false },
  { id: 'faq-5', q: 'Proven Outcomes Across Engagements', a: 'Clients see measurable wins — shorter time-to-fill, lower attrition on contract benches, cleaner audit posture, and predictable monthly billing cycles.', defaultOpen: false },
];

const AccordionItem = ({ id, q, a, defaultOpen }: { id: string; q: string; a: string; defaultOpen: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion-item">
      <h2 className="accordion-header">
        <button
          className={`accordion-button${open ? '' : ' collapsed'}`}
          type="button"
          onClick={() => setOpen(!open)}
        >
          {q}
        </button>
      </h2>
      <div className={`accordion-collapse collapse${open ? ' show' : ''}`}>
        <div className="accordion-body">
          <p>{a}</p>
        </div>
      </div>
    </div>
  );
};

const CareerGuidance = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner1.jpg"
        transparentText="Services"
        title={<>Consulting <span>Services</span></>}
        breadcrumb="Consulting Services"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-115 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Consulting Services</h2>
                <p>Why choose Jobly for workforce consulting?</p>
                <p>Building and scaling a high-performing workforce is hard. Hiring plans go sideways, contractors stretch into year-long engagements without governance, and compliance gaps surface only during an audit. Our consulting practice exists to bring structure, predictability and measurable ROI to every part of your talent operation.</p>
                <div className="media mb-40 mb-md-35 mb-sm-30 mb-xs-25">
                  <img src="/assets/img/project-details/1a.png" alt="Workforce consulting" loading="lazy" decoding="async" />
                </div>
                <p>Jobly partners with growing technology companies, enterprise IT teams, and staffing firms to design talent strategies, optimize delivery operations, and stand up the systems that support sustainable growth. Whether you need a fractional talent leader for 90 days or a multi-year transformation roadmap, our advisors bring deep domain experience across staffing, vendor management, and software training.</p>
                <p>Every engagement is outcome-driven. We start with the business problem — not a generic framework — and deliver crisp recommendations, hands-on execution support, and the operating cadences your team will continue to use long after we leave.</p>

                <h5>WHAT WE DO</h5>
                <p>Our consulting offerings span the full talent lifecycle:</p>
                <ul>
                  <li>Workforce planning and headcount strategy</li>
                  <li>Talent acquisition operating-model design (sourcing, recruiting, employer brand)</li>
                  <li>Contract and vendor management governance</li>
                  <li>Compliance, visa and I-9 advisory (H-1B, L-1, OPT/CPT, E-Verify)</li>
                  <li>HR technology evaluation and rollout (ATS, HRIS, timesheet and billing platforms)</li>
                  <li>Custom software training program design for client teams</li>
                  <li>Bench utilization and profitability optimization for staffing firms</li>
                </ul>

                <h5>WHO WE WORK WITH</h5>
                <p>Our clients fall into three groups:</p>
                <ul>
                  <li><h6>Enterprise IT and engineering teams</h6></li>
                </ul>
                <p>We help large engineering organizations build hybrid workforce strategies that balance full-time hires, contractors and managed-service partners — with clear governance over cost, quality and compliance.</p>
                <ul>
                  <li><h6>Growth-stage technology companies</h6></li>
                </ul>
                <p>We stand up your first formal talent function, design scalable hiring loops, and put the operating systems in place so your recruiting team can keep up with the next 18 months of growth.</p>
                <ul>
                  <li><h6>Staffing and consulting firms</h6></li>
                </ul>
                <p>We work alongside founders and operations leaders at staffing firms to optimize bench utilization, sharpen pricing models, tighten timesheet and billing cycles, and build the playbooks that move you from project-to-project survival into a repeatable engine. Our advisors have personally run staffing P&amp;Ls, so the recommendations are practical, not theoretical.</p>

                <h5>Benefits</h5>
                <ul>
                  <li>Faster time-to-fill on critical roles through better sourcing and interviewer enablement.</li>
                  <li>Lower contractor attrition and stronger client satisfaction on long-running engagements.</li>
                  <li>Audit-ready compliance posture across visa, I-9 and contract documentation.</li>
                  <li>Predictable, on-time monthly billing cycles with reduced revenue leakage.</li>
                </ul>
                <h5>Key Features</h5>
              </div>

              <div className="faq mt-40 mt-md-35 mt-sm-25 mt-xs-20" id="faq">
                {faqs.map((f) => (
                  <AccordionItem key={f.id} {...f} />
                ))}
              </div>
            </div>

            <div className="col-xl-4">
              <ServiceSidebar
                active="/career-guidance"
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

export default CareerGuidance;
