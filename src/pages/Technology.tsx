import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Technology = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner3.jpg"
        transparentText="Technology"
        title={<>Technology <span></span></>}
        breadcrumb="Technology"
      />

      <br /><br /><br />
      <div className="container">
        <div className="row">
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1b.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1c.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1d.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1e.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/salesforce.png" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1g.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1f.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1h.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1i.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/technologies/1j.jpg" alt="" />
          </div>
        </div>
      </div>
      <br /><br />
    </PageLayout>
  );
};

export default Technology;
