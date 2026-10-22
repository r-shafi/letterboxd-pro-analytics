# Analytics Catalog & Mathematical Reference

This document provides formal mathematical definitions, algorithmic rules, and data provenance for all analytics generated in **Letterboxd Pro Analytics** (Sections S1 through S13).

---

## S1. Lifetime Snapshot

| Metric | Formula / Algorithm | Data Source |
| :--- | :--- | :--- |
| **Total Watched Films** | $|U_{watched}| = |\{ f \in \text{Films} \mid f.\text{watched} \lor f.\text{entries} > 0 \lor f.\text{rating} \ne \text{null} \lor f.\text{liked} \}|$ | `watched.csv`, `diary.csv`, `ratings.csv`, `likes/films.csv` |
| **Total Diary Entries** | $N_{logs} = \sum 1$ across all diary records within filter window | `diary.csv` |
| **Total Watch Runtime** | $T_{hours} = \frac{1}{60} \sum_{e \in \text{Entries}} \text{runtime}(e.\text{film})$ | TMDb `runtime` field (minutes) |
| **Runtime Coverage** | $C_{runtime} = \frac{|\{f \in U \mid f.\text{runtime} > 0\}|}{|U|} \times 100\%$ | TMDb match success |
| **Mean User Rating** | $\bar{r} = \frac{1}{N_{rated}} \sum_{i=1}^{N_{rated}} r_i$ (rated on $0.5$ to $5.0$ scale) | `ratings.csv`, `diary.csv` |
| **Rating Coverage** | $C_{rating} = \frac{N_{rated}}{|U|} \times 100\%$ | Rated entries ratio |
| **Date-Unknown Films** | $U_{nodate} = \{ f \in U \mid f \text{ has no diary row with valid watch date} \}$ | Isolated in `watched.csv` / `ratings.csv` |

---

## S2. Film Identity & Archetypes

Data-driven archetype badges are unlocked when user viewing history satisfies deterministic criteria:

1. **The Cinephile Omnivore:** Awarded if unique genres $\ge 12$ and normalized genre Shannon entropy $H_{genre} \ge 0.75$.
2. **The Arthouse Devotee:** Awarded if Hipster Index $\ge 35\%$ ($35\%$ or more of watched films have TMDb popularity $< 15$).
3. **The Golden Era Classicist:** Awarded if $\ge 15\%$ of watched films were released prior to 1970.
4. **The Modern Blockbuster Fan:** Awarded if mean TMDb popularity $> 55.0$ and $\ge 60\%$ of films were released after 2010.
5. **The Auteur Loyalist:** Awarded if top director has $\ge 8$ logged films and average rating for that director $\ge 4.0\bigstar$.
6. **The Globe Trotter:** Awarded if library includes films from $\ge 15$ distinct production countries.
7. **The Short-Form Explorer:** Awarded if $\ge 5$ films have runtime $\le 45$ minutes.

---

## S3. Volume & Viewing Velocity

- **Calendar Date Arithmetic:** Every date is treated as an immutable string `YYYY-MM-DD` converted to days since epoch (Rata Die: $\lfloor 1461(Y + 4800 + \lfloor \frac{M-14}{12} \rfloor)/4 \rfloor + \dots$). Zero timezone shift or DST drift.
- **Active Viewing Streak:** Longest contiguous chain of calendar days with at least 1 logged diary entry:
  $$\text{Streak} = \max_i \{ d_{i} - d_{start} \mid \forall k \in [0, d_i - d_{start}],\, \text{logs}(d_{start} + k) \ge 1 \}$$
- **Marathon Screening Days:** Days where diary entries count $\ge 3$.
- **365-Day Trailing Heatmap:** 5-tier intensity binning based on percentiles of daily viewing velocity:
  $$\text{Level} = \begin{cases} 0 & n = 0 \\ 1 & n = 1 \\ 2 & n = 2 \\ 3 & n = 3 \\ 4 & n \ge 4 \end{cases}$$

---

## S4. Ratings Distribution & Spread

- **Half-Step Distribution:** 10 discrete rating bins ($0.5, 1.0, 1.5, \dots, 5.0\bigstar$).
- **Sample Mean:** $\mu = \frac{1}{N} \sum_{i=1}^N r_i$
- **Median:** Middle value of sorted ratings $r_{(1)} \le r_{(2)} \le \dots \le r_{(N)}$.
- **Sample Standard Deviation:**
  $$\sigma = \sqrt{\frac{1}{N - 1} \sum_{i=1}^N (r_i - \mu)^2}$$
- **Rating Dispersion / Entropy:** Measure of whether ratings cluster on specific stars or spread evenly across the full scale.

---

## S5. The Crowd Contrarian

Measures the divergence between the user's personal taste and the global consensus.

- **Crowd Rating Scale Normalization:** TMDb ratings (0 to 10 scale) are scaled to 5 stars:
  $$r_{crowd} = \frac{\text{voteAverage}}{2}$$
- **Personal Delta:**
  $$\Delta_i = r_{user, i} - r_{crowd, i}$$
  - $\Delta_i > +1.0\bigstar$: Substantial Overrate (User loved it far more than general public).
  - $\Delta_i < -1.0\bigstar$: Substantial Underrate (User was far harsher than general public).
- **Pearson Linear Correlation Coefficient:**
  $$r = \frac{\sum (r_{user} - \bar{r}_{user})(r_{crowd} - \bar{r}_{crowd})}{\sqrt{\sum (r_{user} - \bar{r}_{user})^2 \sum (r_{crowd} - \bar{r}_{crowd})^2}}$$
  - $r \in [0.7, 1.0]$: Mainstream alignment
  - $r \in [0.3, 0.7]$: Moderate independent taste
  - $r < 0.3$: Distinct contrarian viewpoint

---

## S6. Taste Profile & Bayesian Smoothing

When grouping average ratings by small sample sizes (e.g. an obscure genre with only 2 viewings), raw sample means are vulnerable to extreme noise. We apply **Bayesian Shrinkage** towards the user's global mean $\mu_0$:

$$\tilde{\mu}_g = \frac{n_g \bar{r}_g + k \mu_0}{n_g + k}$$

where:
- $\bar{r}_g$ = observed mean rating in group $g$
- $n_g$ = number of films rated in group $g$
- $\mu_0$ = user's global average rating
- $k = 5$ = pseudo-observation shrinkage factor

- **Hipster Index:**
  $$\text{Hipster} = \frac{|\{f \in U \mid f.\text{popularity} < 15.0\}|}{|U|} \times 100\%$$
- **Shannon Diversity Entropy (Normalized):**
  $$H = -\frac{\sum_{i=1}^K p_i \ln(p_i)}{\ln(K)}$$
  where $p_i = \frac{n_i}{N}$ is the proportion of films in category $i$, and $K$ is the number of observed categories ($H \in [0, 1]$).

---

## S7. People & Collaborations

- **Rankings:** Most viewed Directors, Lead Actors, Screenwriters, Cinematographers, Composers.
- **Minimum Threshold:** Highlighted averages require $\ge 2$ viewed titles.
- **Top Collaborative Pairings:** Frequency matrix of $(Director, Actor)$ and $(Director, Composer)$ co-appearances in watched titles.

---

## S8. World Cinema & Language Geography

- **Country Attribution:** Production countries from TMDb `production_countries` (ISO 3166-1 alpha-2 codes).
- **Language Attribution:** TMDb `original_language` code (ISO 639-1).
- **Foreign Language Share:** Percentage of watched films whose original language is not English (`en`).

---

## S9. Genres & Decades Co-Occurrence

- **Decade Aggregation:** Floor release year to 10s: $\text{decade} = \lfloor \frac{\text{year}}{10} \rfloor \times 10$.
- **Primary vs Secondary Genre:** Primary genre assigned by TMDb order.
- **Co-occurrence Matrix:** Cross-tabulation of genre pairings occurring within the same film.

---

## S10. Rewatches & Repeat Velocity

- **Rewatch Flag:** Identified via diary row `Rewatch === 'Yes'` or when film key appears $> 1$ time in viewing history.
- **Rewatch Rate:**
  $$\text{Rewatch Rate} = \frac{N_{rewatches}}{N_{logs}} \times 100\%$$
- **Repeat Velocity:** Mean days elapsed between repeated viewings of the same film.

---

## S11. Words, Reviews & Tags

- **Stopword Pruning:** Words stripped against an allowlisted stoplist comprising standard English stop words (articles, prepositions, common conjunctions) plus Letterboxd-specific boilerplate ("film", "movie", "watch", "one", "like", "just", "time", "story").
- **Tag Frequency:** Direct count of user tags applied in diary and review entries.

---

## S12. Watchlist Predictive Intelligence

Predicts which unviewed watchlist films the user is most likely to rate highest based on established preferences:

$$\hat{R}(f) = w_d \cdot \tilde{\mu}_{\text{dir}} + w_g \cdot \tilde{\mu}_{\text{genre}} + w_a \cdot \tilde{\mu}_{\text{actor}} + w_c \cdot r_{\text{crowd}}$$

with weights:
- $w_d = 0.40$ (Director affinity)
- $w_g = 0.25$ (Genre affinity)
- $w_a = 0.20$ (Lead actor affinity)
- $w_c = 0.15$ (Global crowd baseline)

If a metadata dimension has no historical views, its weight dynamically shifts to the user's global mean $\mu_0$.

---

## S13. Superlative Records & Quirks

- **Runtime Extremes:** Maximum and minimum runtime (excluding 0 or missing runtimes).
- **Temporal Extremes:** Earliest release year, most recent release year, longest gap between release year and watch date.
- **Peak Calendar Milestone:** Single day with highest logged film volume.
