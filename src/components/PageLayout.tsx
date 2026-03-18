import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

const PageLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="body-wrapper">
    <Navbar />
    <main>{children}</main>
    <Footer />
  </div>
);

export default PageLayout;
