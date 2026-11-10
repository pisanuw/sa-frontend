import React from "react";
import "../components/styles/Footer.css";

const REPO_URL = "https://github.com/stem-accessibility/frontend";
const ISSUES_URL = `${REPO_URL}/issues/new`;
const CONTACT_EMAIL = "stem-accessibility@uw.edu";
const ARBORETUM_URL = "https://github.com/ritesh-kanchi/Arboretum";
const ARBORETUM_PAPER_URL = "https://dl.acm.org/doi/10.1145/3772318.3791656";
const OLLI_URL = "https://github.com/umwelt-data/olli";
const MATHJAX_URL = "https://www.mathjax.org/";
const SRE_URL = "https://github.com/Speech-Rule-Engine/speech-rule-engine";

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="site-footer__inner">
        <div className="site-footer__row">
          <span className="site-footer__label">Questions?</span>

          <div className="site-footer__links">
            <a href={`mailto:${CONTACT_EMAIL}`} className="site-footer__link">
              {CONTACT_EMAIL}
            </a>
            <a
              href={REPO_URL}
              className="site-footer__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source code on GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <a
              href={ISSUES_URL}
              className="site-footer__link site-footer__link--primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Submit an issue
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>

        <p className="site-footer__credit">
          Tree, list, and array STEM images use code and designs from{" "}
          <a
            href={ARBORETUM_URL}
            className="site-footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Arboretum
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          by Kanchi, Frierson, Potluri, Metoyer, Mankoff, Natsuhara, and Wang (
          <a
            href={ARBORETUM_PAPER_URL}
            className="site-footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            paper
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          ), used under the MIT license.
        </p>

        <p className="site-footer__credit">
          Navigable charts use{" "}
          <a
            href={OLLI_URL}
            className="site-footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Olli
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          from the MIT Visualization Group, used under the BSD 3-Clause license.
        </p>

        <p className="site-footer__credit">
          Math uses{" "}
          <a
            href={MATHJAX_URL}
            className="site-footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            MathJax
            <span className="sr-only"> (opens in a new tab)</span>
          </a>{" "}
          and the{" "}
          <a
            href={SRE_URL}
            className="site-footer__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Speech Rule Engine
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          , used under the Apache 2.0 license.
        </p>

        <div className="site-footer__sub">
          © {year} STEM-Accessibility
        </div>
      </div>
    </footer>
  );
};

export default Footer;
