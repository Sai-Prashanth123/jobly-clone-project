import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Clients = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner4.jpg"
        transparentText="Clients"
        title={<>Clients <span></span></>}
        breadcrumb="Clients"
      />

      <br /><br /><br />
      <div className="container">
        <div className="row">
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7a.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7b.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7c.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7d.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7e.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7f.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7g.jpg" alt="" />
          </div>
          <div className="col-lg-4">
            <img src="/assets/img/clients/client7h.jpg" alt="" />
          </div>
        </div>
      </div>
      <br /><br />
    </PageLayout>
  );
};

export default Clients;
