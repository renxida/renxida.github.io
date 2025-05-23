---
# An instance of the Experience widget.
# Documentation: https://wowchemy.com/docs/page-builder/
widget: experience

# This file represents a page section.
headless: true

# Order that this section appears on the page.
weight: 40

title: Experience
subtitle:

# Date format for experience
#   Refer to https://wowchemy.com/docs/customization/#date-format
date_format: Jan 2006

# Experiences.
#   Add/remove as many `experience` items below as you like.
#   Required fields are `title`, `company`, and `date_start`.
#   Leave `date_end` empty if it's your current employer.
#   Begin multi-line descriptions with YAML's `|2-` multi-line prefix.
experience:
  - title: Research Intern
    company: Intel Labs
    company_url: 'https://www.intel.com/content/www/us/en/research/overview.html'
    company_logo: org-intellabs
    location: Portland, Oregon
    date_start: '2022-08-22'
    date_end: ''
    description: |2-
        * Profile workloads to generate architecture-independent workload summaries that use Basic Block Vectors to accurately predicts workload performance on novel hardware.
        * Accelerate summary generation by 1,000,000x using hardware performance counters.
        * Generate multi-platform executable benchmarks based on performance summaries using MLIR.
        * Use differential privacy to enable trace-sharing across organizational boundaries without concern for leaking sensitive IP.

  - title: PhD Candidate
    company: University of Virginia
    company_url: 'https://engineering.virginia.edu/departments/computer-science'
    company_logo: org-uva
    location: Charlottesville, VVirginia
    date_start: '2019-08-23'
    date_end: ''
    description: |2-
      * Discovered [I See Dead Micro-Ops](https://ieeexplore.ieee.org/document/9499837), a critical security flaw that threatened execution integrity and data security in modern x86 processors. Published at [ISCA 2021](https://iscaconf.org/isca2021/).
      * Developed performance preserving Spectre defenses for SMT, published under [SecSMT](https://www.usenix.org/conference/usenixsecurity22/presentation/taram) at [USENIX Security 2022](https://www.usenix.org/conference/usenixsecurity22).
      * Applying formal verification to ensure that quantized machine learning models remained invulnerable to adversarial attacks using DNNV (https://github.com/dlshriver/dnnv), ONNX, and ReluPlex (https://arxiv.org/abs/1702.01135)
      * Mentoring 5 undergraduate students on computer architecture and machine learning projects, breaking down large projects into digestible chunks, as well as providing instruction on computer architecture, side-channel attacks, machine learning compilers, and ML models (incl. model specification, feature engineering, parameter tuning, and cross-validation).

design:
  columns: '2'
---
