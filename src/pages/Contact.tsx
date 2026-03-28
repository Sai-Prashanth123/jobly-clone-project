import PageLayout from '@/components/PageLayout';
import PageBanner from '@/components/PageBanner';

const Contact = () => {
  return (
    <PageLayout>
      <PageBanner
        bgImage="/assets/img/page-banner/page-banner-1.jpg"
        transparentText="Contact"
        title={<>Contact <span>With Us</span></>}
        breadcrumb="Contact Us"
      />

      {/* contact-us start */}
      <section className="contact-us pb-xs-80 pt-xs-80 pt-sm-100 pb-sm-100 pt-md-100 pb-md-100 pt-120 pb-120 overflow-hidden">
        <div className="container">
          <div className="row">
            <div className="col-lg-6">
              <div className="contact-us__content">
                <h6 className="sub-title fw-500 color-primary text-uppercase mb-sm-15 mb-xs-10 mb-20">
                  <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" /> contact
                </h6>
                <h2 className="title color-d_black mb-sm-15 mb-xs-10 mb-20">Get in Touch</h2>
                <div className="description font-la">
                  <p>We genuinely have certainty that business elements develop and advance not just through the movement in their particular organizations additionally by designing a situation which consoles self-examination and enablement.</p>
                </div>
              </div><br />
              <div className="row contact-us__item-wrapper mt-xs-35 mt-sm-40 mt-md-45">
                <div className="col-sm-6">
                  <div className="contact-us__item mb-40">
                    <div className="contact-us__item-header mb-25 mb-md-20 mb-sm-15 mb-xs-10 d-flex align-items-center">
                      <div className="icon mr-10 color-primary">
                        <i className="fas fa-map-marker-alt"></i>
                      </div>
                      <h5 className="title color-d_black">Office</h5>
                    </div>
                    <div className="contact-us__item-body font-la">
                      110 Samaritan Dr Suite#211, Cumming, GA, 30040, USA
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="contact-us__item mb-40">
                    <div className="contact-us__item-header mb-25 mb-md-20 mb-sm-15 mb-xs-10 d-flex align-items-center">
                      <div className="icon mr-10 color-primary">
                        <i className="fas fa-phone"></i>
                      </div>
                      <h5 className="title color-d_black">Call Us</h5>
                    </div>
                    <div className="contact-us__item-body font-la">
                      <ul>
                        <li><a href="tel:+14048635745">+1 404-863-5745</a></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="contact-us__item mb-40">
                    <div className="contact-us__item-header mb-25 mb-md-20 mb-sm-15 mb-xs-10 d-flex align-items-center">
                      <div className="icon mr-10 color-primary">
                        <i className="fas fa-phone"></i>
                      </div>
                      <h5 className="title color-d_black">Fax</h5>
                    </div>
                    <div className="contact-us__item-body font-la">
                      <ul>
                        <li><a href="tel:+14706605973">+1 470 660 5973</a></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="col-sm-6">
                  <div className="contact-us__item mb-40">
                    <div className="contact-us__item-header mb-25 mb-md-20 mb-sm-15 mb-xs-10 d-flex align-items-center">
                      <div className="icon mr-10 color-primary">
                        <i className="fas fa-envelope"></i>
                      </div>
                      <h5 className="title color-d_black">Email Us</h5>
                    </div>
                    <div className="contact-us__item-body font-la">
                      <ul>
                        <li><a href="mailto:info@joblysolutions.com">info@joblysolutions.com</a></li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="contact-form pt-md-30 pt-sm-25 pt-xs-20 pb-md-40 pb-sm-35 pb-xs-30 pt-xl-30 pb-xl-50 pt-45 pr-xl-50 pl-md-40 pl-sm-30 pl-xs-25 pr-md-40 pr-sm-30 pr-xs-25 pl-xl-50 pr-85 pb-60 pl-85">
                <div className="contact-form__header mb-sm-35 mb-xs-30 mb-40">
                  <h6 className="sub-title fw-500 color-primary text-uppercase mb-15">
                    <img src="/assets/img/team-details/badge-line.svg" className="img-fluid mr-10" alt="" /> Need help?
                  </h6>
                  <h3 className="title color-d_black">Contact Us</h3>
                </div>

                <form className="hm_contact_form" onSubmit={(e) => e.preventDefault()}>
                  <div className="form_row clearfix">
                    <label><span className="hm_field_name">Name</span><span className="hm_requires_star">*</span></label>
                    <input className="form_fill_fields hm_input_text form-control" type="text" placeholder="Full Name" required />
                  </div>
                  <div className="form_row clearfix">
                    <label><span className="hm_field_name">Email</span><span className="hm_requires_star">*</span></label>
                    <input className="form_fill_fields hm_input_text form-control" type="email" placeholder="mail@sitename.com" required />
                  </div>
                  <div className="form_row clearfix">
                    <label><span className="hm_field_name">Phone</span></label>
                    <input className="form_fill_fields hm_input_text form-control" type="text" />
                  </div>
                  <div className="form_row clearfix">
                    <label><span className="hm_field_name">Subject</span></label>
                    <input className="form_fill_fields hm_input_text form-control" type="text" />
                  </div>
                  <div className="form_row clearfix">
                    <label><span className="hm_field_name">Message</span><span className="hm_requires_star">*</span></label>
                    <textarea className="form_fill_fields hm_textarea form-control" required></textarea>
                  </div>
                  <div className="form_row clearfix">
                    <button type="submit" className="send_button full_button default-btn btn-two theme-btn btn-sm btn-red">
                      <span>Send Your Message</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* contact-us end */}

      {/* contact-map */}
      <div className="container">
        <div id="contact-map" className="mb-sm-30 mb-xs-25"></div>
      </div>
    </PageLayout>
  );
};

export default Contact;
