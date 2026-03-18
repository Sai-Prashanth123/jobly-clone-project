import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';
import ServiceSidebar from '@/components/ServiceSidebar';

const SoftwareTraining = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner1.jpg"
        transparentText="Services"
        title={<>Software Training <span>Service</span></>}
        breadcrumb="Software Training"
      />

      {/* services-details start */}
      <section className="services-details pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-115 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-xl-8">
              <div className="services-details__content">
                <h2>Software Training</h2>
                <p>Accelerate your Career Growth &amp; Upskill Yourself</p>
                <p>Whether you're a home-based teacher, a leadership coach, Jobly empowers you to take your talent far and wide, build a dedicated community, and turn your passion into a rewarding profession.</p>
                <div className="media mb-40 mb-md-35 mb-sm-30 mb-xs-25">
                  <img src="/assets/img/project-details/1c.png" alt="" />
                </div>

                <h5>Create courses that reflect your expertise</h5>
                <p>We give you a no-frills set up that helps transform your knowledge into impactful content. Pass on your wisdom in any which way you like: a self-paced module, a live virtual session, or an in-person program.</p>
                <h5>Gather a vibrant community</h5>
                <p>Jobly provides a platform to create and nurture your own learning community and build long-term trust. Through our virtual classroom technology and immersive engagement features, you can establish a human connection with all your learners.</p>
                <p>Build a business you can be proud of</p>
                <p>Get all the right tools to power your training profession. From an intuitive website builder to customizable branding and payment management, you have a supportive business partner in Jobly.</p>
                <h5>Get actionable insights, every time.</h5>
                <p>With a comprehensive dashboard offering detailed analytics on subscription trends, learner progress, and course feedback, you are always in full control of your business. Bring more experts to the fore and manage your team effortlessly using Jobly's admin console.</p>

                <h4>Explore courses</h4>
                <div className="row">
                  <div className="col-md-6">
                    <h5>Data Science Courses</h5>
                    <p>Our Data Science certification courses aim to accelerate your Data Science career by making you proficient in this domain. We aim to make you proficient in this field by helping you learn both basic and advanced concepts of Data Science, along with getting exposure to programming languages and technologies including Python, R, Hadoop, Tableau, and Spark.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Big Data Analytics Courses</h5>
                    <p>Big Data Analytics courses are curated by experts in the industry from some of the top MNCs in the world. The main aim of Data Analytics online courses is to help you master Big Data Analytics by helping you learn its core concepts and technologies including simple linear regression, prediction models, deep learning, machine learning, etc.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Cloud Computing Courses Certification Training Online</h5>
                    <p>Our online Cloud Computing courses will equip you to master significant concepts of Cloud Computing and implement its various services. You will get an in-depth understanding of cloud hosting service providers and their architecture, deployment, services, and many more to solve any business infrastructure problems.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Business Intelligence Courses</h5>
                    <p>These Business Intelligence courses are chosen to help you learn the most demanded BI tools in the market. With Business Intelligence and Analytics, organizations can convert data into useful business insights. Thanks to the humongous amounts of data that we are generating these days, there is a high demand for qualified Business Intelligence professionals.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Salesforce CRM Certification Training Online Courses</h5>
                    <p>These Salesforce CRM certification courses offered by Jobly help you master the necessary concepts of Salesforce, such as Service Cloud and Sales Cloud, Salesforce objects, quote templates, lightning components, reports, data management, etc.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Database Certification Courses Training Online</h5>
                    <p>The database courses offered by Jobly focus on the complete set of tools and technologies essential to work with popular DB systems. In a world where data is churned out and stored endlessly, databases have become increasingly functional and practical with quicker data processing.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Online Programming Courses</h5>
                    <p>Jobly's online programming courses offer you training on a variety of programming languages, such as C, C++, R, Python, JavaScript, and more. The courses are for all skill levels, and you can choose to learn any or all courses as per your wish.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Web Development Courses</h5>
                    <p>Our web development courses will help you learn to code and build your own websites using frontend programming languages such as CSS, HTML, and JavaScript. By enrolling in these training programs, you will be proficient in web development.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Testing Courses Online</h5>
                    <p>Testing courses offered at Jobly cover the entire testing domain, and they are all in line with standard industry certifications. Software is crucial to any organization, and this puts pressure on testing it to get it right.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Degree Courses Jobly</h5>
                    <p>Get enrolled in degree programs offered by world top universities and accelerate your career. Learn from leading faculty with world class pedagogy. Get one-on-one mentorship sessions, career services, visa assistance for abroad travel, and placement opportunities with our 400+ hiring partners worldwide.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Digital Marketing Courses</h5>
                    <p>This Digital Marketing courses category includes all the training courses in the digital marketing arena. Digital marketing is being deployed by every organization that wants to garner the attention of its customers in the digital world.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>AI &amp; Machine Learning Courses</h5>
                    <p>Jobly's set of Artificial Intelligence and Machine Learning courses aims to help you pursue a career in these popular and demanding IT fields i.e., AI &amp; Machine learning by making you proficient in them.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Project Management Courses Online</h5>
                    <p>This section includes top Project Management courses online. You will master tools such as Six Sigma, Agile, Microsoft Excel, Certified ScrumMaster, CBAP, and Microsoft Dynamics 365. The entire range of Project Management training programs is in line with the respective industry standards.</p>
                  </div>
                  <div className="col-md-6">
                    <h5>Cyber Security Course Online</h5>
                    <p>Cyber Security programs will help you master Cybersecurity which is a form of protection offered to connected systems such as mobile devices, servers, programs, and networks from malicious cyber-attacks.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-4">
              <ServiceSidebar
                active="/software-training"
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

export default SoftwareTraining;
