import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const faqs = [
  { id: 'faq-1', q: 'High Predictive Accuracy', a: 'Our advanced assessments ensure accuracy and validity of results', defaultOpen: true },
  { id: 'faq-2', q: 'Multi-Pronged Assessment', a: 'Gain a detailed understanding of yourself to get best-fit career options or recommendations, with personalized development plans to help you improve.', defaultOpen: false },
  { id: 'faq-3', q: 'Unified Decision – Tree Framework', a: 'The assessments are based on a single framework and are linked to one another, leading to a consistent outcome across grades.', defaultOpen: false },
  { id: 'faq-4', q: 'Advanced Algorithms', a: 'Our assessments run on advanced algorithms that keep evolving and improving over time as the user base keeps expanding.', defaultOpen: false },
  { id: 'faq-5', q: 'High Success Rate', a: '96% students and professionals have had better academic scores, college admissions, and career advancement', defaultOpen: false },
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
        title={<>Career Guidance <span>Service</span></>}
        breadcrumb="Career Guidance Service"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-115 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Career Guidance Service</h2>
                <p>Why go for career guidance at Jobly?</p>
                <p>We know seeking clarity on streams, college selection, overseas education, and career planning is extremely hard! Career counselling for students from the right place at the right time is the need of hour.</p>
                <div className="media mb-40 mb-md-35 mb-sm-30 mb-xs-25">
                  <img src="/assets/img/project-details/1a.png" alt="" />
                </div>
                <p>That's where we come into the picture! To help you focus on your dream career. Wherever you are in your studies or career, we can help you make decisions with our career counseling. So, if you're deciding what to do next after 10th, intermediate, engineering, B. Com, B. Sc, B.A, or Post Graduation, we can assist you!</p>
                <p>For all your career planning, please contact us. You won't be disappointed with the advice you get and will be confident that you're making the right choice in this important decision. Here at Jobly, we provide career guidance and counseling. Our services are available to students of all ages as well as working professionals.</p>
                <h5>WHAT DO WE DO?</h5>
                <p>There are many steps to our guidance processes. We make sure that we are thorough and are giving you only the best advice and guidance. Our service includes:</p>
                <ul>
                  <li>A career assessment test</li>
                  <li>A personalized comprehensive career report</li>
                  <li>Guidance and counseling</li>
                  <li>Suggestions of suitable career options</li>
                  <li>Provision of details about suitable and preferable courses, streams, and majors</li>
                  <li>Provision of information about entrance examinations</li>
                  <li>Clarification of doubts and help in selecting the right stream for you</li>
                </ul>

                <h5>WHO DO WE PROVIDE SERVICES FOR?</h5>
                <p>We provide career guidance and counseling to:</p>
                <ul>
                  <li><h6>Students in the 9th or 10th class</h6></li>
                </ul>
                <p>We help you select the right stream or subject and take you toward the most suitable career path.</p>
                <ul>
                  <li><h6>Students of intermediate, plus 2, 11th and 12th</h6></li>
                </ul>
                <p>We relieve you of your college admissions &amp; processes stress; we know how lengthy and tiring it can be</p>
                <ul>
                  <li><h6>Students pursuing graduation and post-graduation courses</h6></li>
                </ul>
                <p>We keep you informed with the latest industry trends; what skills are best for you to learn &amp; how you can successfully transition from college to world of job and careers. In every aspect of your career journey, our guided exploration for over 550+ career options, psychometric career assessment test and counselling from experienced career advisor is all you need to make a perfect decision for your career!</p>

                <h5>Benefits</h5>
                <ul>
                  <li>Build awareness about available career options as per your interests &amp; academic choices.</li>
                  <li>Recognize your overall aptitude, strengths, and weaknesses.</li>
                  <li>Create a roadmap for your entire career.</li>
                  <li>Take an informed decision to choose your career options.</li>
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
