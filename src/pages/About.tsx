// src/pages/About.tsx
import React from "react";
import "./styles/AboutPage.css";

const ARBORETUM_URL = "https://github.com/ritesh-kanchi/Arboretum";
const ARBORETUM_PAPER_URL = "https://dl.acm.org/doi/10.1145/3772318.3791656";
const OLLI_URL = "https://github.com/umwelt-data/olli";
const OLLI_DOCS_URL = "https://umwelt-data.github.io/olli/";
const MATHJAX_URL = "https://www.mathjax.org/";
const SRE_URL = "https://github.com/Speech-Rule-Engine/speech-rule-engine";
//const BRIANNA_URL = "https://www.briannawimer.com/";

const About: React.FC = () => {
  return (
    <main className="about" aria-labelledby="about-title">
      <header className="about__hero">
        <div className="about__heroInner">
          <h1 id="about-title" className="about__title">
            About STEM-Accessibility
          </h1>
          <p className="about__lede">
            STEM-Accessibility is a research-driven platform for making STEM images meaningfully accessible.
          </p>
        </div>
      </header>

      <div className="about__content">
        {/* Overview */}
        <section className="about__section" aria-labelledby="overview-title">
          <h2 id="overview-title" className="about__h2">
            What STEM-Accessibility is
          </h2>
          <p className="about__p">
            STEM images—such as flowcharts, decision trees, process maps, and organizational charts—play a central role in how people learn, reason, and communicate. Yet they are still largely treated as static images, leaving many
            people without access to the information they convey.
          </p>
          <p className="about__p">
            STEM-Accessibility is built on the idea that accessibility improves when STEM image structure is made explicit. Instead of asking people to describe images after the fact, we treat STEM images as structured systems made up of
            nodes, relationships, and meaning. This allows a single STEM image to be expressed in multiple accessible
            forms, including long descriptions, keyboard-navigable views, and tactile or auditory outputs—without losing
            the underlying logic.
          </p>
        </section>

        {/* The problem */}
        <section className="about__section" aria-labelledby="problem-title">
          <h2 id="problem-title" className="about__h2">
            The problem
          </h2>
          <p className="about__p">
            For many blind and disabled learners, STEM images remain one of the most persistent barriers to understanding
            course material, documentation, and decision-making tools. When STEM images are inaccessible, access is
            delayed, partial, or missing entirely.
          </p>
          <p className="about__p">
            Today, accessibility often relies on manual, one-off fixes: writing ad-hoc descriptions, retrofitting images,
            or relying on individual expertise without shared tools or structure. This approach doesn’t scale, and it
            rarely supports deeper understanding of how a STEM image actually works.
          </p>
          <p className="about__p">
            At the same time, the responsibility for providing accessible STEM images often falls on people who are not
            accessibility experts—or who did not originally design the STEM image and may lack deep domain knowledge of its
            content. Existing accessibility guidance for STEM images is often fragmented, underspecified, or focused on
            minimum requirements rather than on what it actually means to understand a STEM image. As a result, STEM images
            may technically meet guidelines while still failing to provide real access.
          </p>
        </section>

        {/* Our approach */}
        <section className="about__section" aria-labelledby="approach-title">
          <h2 id="approach-title" className="about__h2">
            Our approach
          </h2>
          <p className="about__p">
            STEM-Accessibility extracts STEM image structure from images and enables STEM images to be explored, verified, and
            transformed across multiple modalities. This approach supports clearer descriptions, more reliable
            navigation, and representations that align with how people reason about STEM images—not just how they look.
          </p>
          <p className="about__p">
            The accessible representations produced by STEM-Accessibility are grounded in accessibility research. We are collecting solutions from multiple papers that address these issues.
          </p>
         
        </section>

        {/* Arboretum */}
        <section className="about__section" aria-labelledby="arboretum-title">
          <h2 id="arboretum-title" className="about__h2">
             Arboretum
          </h2>
          <p className="about__p">
            Support for trees, binary trees, linked lists, and arrays uses code and output designs from{" "}
            <a className="about__link" href={ARBORETUM_URL} target="_blank" rel="noopener noreferrer">
              Arboretum<span className="sr-only"> (opens in a new tab)</span>
            </a>
            , an open-source tool for authoring accessible data structures, released under the MIT license.
            Arboretum was created by Ritesh Kanchi, Kaija Frierson, Venkatesh Potluri, Ronald Metoyer, Jennifer Mankoff, Miya Natsuhara, and Matt X. Wang.
          </p>
          <div className="about__callout" role="note" aria-label="Arboretum publication">
            <div className="about__calloutTitle">Arboretum paper</div>
            <a className="about__link" href={ARBORETUM_PAPER_URL} target="_blank" rel="noopener noreferrer">
              Read the Arboretum paper (ACM Digital Library)
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </section>
        {/* Olli */}
        <section className="about__section" aria-labelledby="olli-title">
          <h2 id="olli-title" className="about__h2">
            Olli
          </h2>
          <p className="about__p">
            The navigable chart on the Charts page is built with{" "}
            <a className="about__link" href={OLLI_URL} target="_blank" rel="noopener noreferrer">
              Olli<span className="sr-only"> (opens in a new tab)</span>
            </a>
            , an open-source library from the MIT Visualization Group that turns a visualization into a structured
            outline that screen reader users can explore by keyboard, released under the BSD 3-Clause license. Olli
            lets you move from the whole chart down to individual values, jump to an axis, and open the underlying
            data as a table.
          </p>
          <div className="about__callout" role="note" aria-label="Olli documentation">
            <div className="about__calloutTitle">Olli documentation</div>
            <a className="about__link" href={OLLI_DOCS_URL} target="_blank" rel="noopener noreferrer">
              Read the Olli documentation
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </section>
        {/* Math */}
        <section className="about__section" aria-labelledby="math-title">
          <h2 id="math-title" className="about__h2">
            Math and braille
          </h2>
          <p className="about__p">
            Math written in a long description is drawn with{" "}
            <a className="about__link" href={MATHJAX_URL} target="_blank" rel="noopener noreferrer">
              MathJax<span className="sr-only"> (opens in a new tab)</span>
            </a>
            , which reads it aloud, lets people explore it piece by piece with the keyboard, and gives
            braille displays the Nemeth braille. The braille file of every STEM image uses uncontracted
            Unified English Braille for text and Nemeth Code for math, made with the{" "}
            <a className="about__link" href={SRE_URL} target="_blank" rel="noopener noreferrer">
              Speech Rule Engine<span className="sr-only"> (opens in a new tab)</span>
            </a>
            . Both are open source under the Apache 2.0 license.
          </p>
        </section>

        {/* ALT text (to be added) */}

        {/* Who it's for */}
        <section className="about__section" aria-labelledby="for-title">
          <h2 id="for-title" className="about__h2">
            Who STEM-Accessibility is for
          </h2>
          <p className="about__p">
            STEM-Accessibility is designed for educators, researchers, instructional designers, and organizations that rely on
            STEM images to teach, explain, and communicate ideas—and who want those STEM images to be usable by everyone.
          </p>
          <p className="about__p">
            If you create, maintain, or are responsible for sharing STEM images—and need to provide accessible access to
            them without being an accessibility specialist or a domain expert—STEM-Accessibility provides structured support to
            make that possible.
          </p>
        </section>

        {/* Creator 
        <section className="about__section" aria-labelledby="creator-title">
          <h2 id="creator-title" className="about__h2">
            About the creator
          </h2>
          <p className="about__p">
            STEM-Accessibility was created by{" "}
            <a className="about__link" href={BRIANNA_URL} target="_blank" rel="noopener noreferrer">
              Brianna Wimer
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            , a Google PhD Fellow in Human-Computer Interaction whose research focuses on making diagrams and
            visualizations accessible to people with disabilities.
          </p>
        </section> */}
      </div>
    </main>
  );
};

export default About;
