"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaExternalLinkAlt, FaHeart } from "react-icons/fa";
import styles from "../terms/legal.module.css";

interface AttributionItem {
  name: string;
  category: string;
  description: string;
  license: string;
  url: string;
}

const API_DATASET_ATTRIBUTIONS: AttributionItem[] = [
  {
    name: "ISO 639-3 Language Codes (maikudou/iso639-js)",
    category: "Languages Category",
    description: "Standardized international three-letter code mapping and names for global living and historical languages.",
    license: "MIT License",
    url: "https://raw.githubusercontent.com/maikudou/iso639-js/master/reference/iso639-3.json",
  },
  {
    name: "PokéAPI (pokeapi.co)",
    category: "Pokémon Category",
    description: "Comprehensive RESTful Pokémon database utilized for authentic creature names and regional variants.",
    license: "BSD 3-Clause / Fair Use Educational",
    url: "https://pokeapi.co/",
  },
  {
    name: "Periodic Table Dataset (neelpatel05/periodic-table-api)",
    category: "Chemical Elements Category",
    description: "Curated dataset providing chemical element names, symbols, atomic numbers, and periodic classifications.",
    license: "Open Data / MIT",
    url: "https://raw.githubusercontent.com/neelpatel05/periodic-table-api/master/data.json",
  },
  {
    name: "Country State City Reference API",
    category: "Geography & Capital Cities",
    description: "Global geographic directory reference used for country, state, city, and capital validation datasets.",
    license: "Open Data Commons",
    url: "https://csc.sidsworld.co.in/public/api",
  },
  {
    name: "Corpora Project (dariusk/corpora)",
    category: "Vocabulary & General Reference",
    description: "Curated collections of public domain and open culture reference wordlists for categories such as foods, animals, and common nouns.",
    license: "CC0 1.0 Universal (Public Domain)",
    url: "https://github.com/dariusk/corpora",
  },
];


export default function CreditsPage() {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.legalWrapper}>
      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>CREDITS &amp; ATTRIBUTIONS</h1>
          <p className={styles.heroSubtitle}>
            ScatterBlitz is powered by wonderful open datasets, public API references, and open-source software libraries. We gratefully acknowledge and credit these creators.
          </p>
          <span className={styles.dateBadge}>Last Updated: November 24, 2026</span>
        </div>

        <div className={styles.articlesContainer}>
          {/* Section 1: External Datasets & Category APIs */}
          <section className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>CATEGORY APIS &amp; DATASETS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <p className={styles.paragraph}>
                Our validation dictionary and category deck ingestion workers reference and ingest verified knowledge sets from the following free, open, and public API services:
              </p>
              <ul className={styles.bulletList} style={{ listStyle: "none", paddingLeft: 0 }}>
                {API_DATASET_ATTRIBUTIONS.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: "1.25rem", padding: "1rem", background: "rgba(255, 122, 0, 0.04)", borderRadius: "12px", border: "1px solid rgba(255, 122, 0, 0.15)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.25rem" }}>
                      <strong style={{ fontSize: "1.05rem", color: "var(--amber)" }}>{item.name}</strong>
                      <span style={{ fontSize: "0.78rem", background: "rgba(255, 183, 3, 0.15)", color: "var(--gold)", padding: "0.2rem 0.55rem", borderRadius: "8px", fontWeight: 700 }}>
                        {item.license}
                      </span>
                    </div>
                    <p style={{ margin: "0.3rem 0 0.5rem", color: "var(--text-secondary)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                      {item.description}
                    </p>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--sunset)", fontSize: "0.85rem", textDecoration: "underline" }}
                    >
                      Visit Resource <FaExternalLinkAlt size={10} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>


          {/* Section 3: Proprietary Notice */}
          <section className={styles.sectionRow}>
            <div className={styles.sectionTitleCol}>
              <h2 className={styles.sectionTitle}>PROPRIETARY RIGHTS</h2>
            </div>
            <div className={styles.sectionContentCol}>
              <div className={styles.callout}>
                <strong>All Rights Reserved Notice:</strong>
                <p style={{ marginTop: "0.4rem", marginBottom: 0 }}>
                  While ScatterBlitz proudly utilizes open-source libraries and open datasets under their respective licenses, the ScatterBlitz codebase, proprietary game orchestration engine, scoring algorithms, branding, visuals, trademarks, and associated application assets are copyrighted property. <strong>All rights reserved. ScatterBlitz is proprietary software and not open source.</strong>
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className={styles.footerNote}>
          Crafted with <FaHeart style={{ color: "var(--safety-orange)", verticalAlign: "middle" }} /> by the ScatterBlitz Team. For inquiries regarding licensing or data partnerships, contact us through our official support channels.
        </div>
      </main>
    </div>
  );
}
