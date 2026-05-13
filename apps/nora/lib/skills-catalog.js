/**
 * Grade 5 Math Skills Definitions
 * Organized by category with labels and generation guidance
 */

export const MATH_SKILLS_CATALOG = {
  // Whole Numbers & Operations
  'whole-numbers': {
    category: 'A. Place Values And Number Sense',
    categoryId: 'whole-numbers',
    skills: [
      {
        id: 'place-value',
        name: 'Place Value',
        label: '📍 Place Value',
        description: 'Understanding digits in ones, tens, hundreds, thousands, etc.',
      },
      {
        id: 'rounding',
        name: 'Rounding',
        label: '🔄 Rounding Numbers',
        description: 'Round whole numbers to nearest 10, 100, 1000',
      },
      {
        id: 'roman-numerals',
        name: 'Roman Numerals',
        label: '🏛️ Roman Numerals',
        description: 'Convert between standard and Roman numerals (I, V, X, L, C, D, M)',
      },
    ],
  },

  // Addition & Subtraction
  'addition-subtraction': {
    category: 'B. Addition And Subtraction',
    categoryId: 'add-sub',
    skills: [
      {
        id: 'add-sub-whole',
        name: 'Add/Subtract Whole Numbers',
        label: '➕➖ Column Add/Subtract',
        description: 'Multi-digit addition and subtraction with regrouping',
        problemType: 'column-method',
      },
      {
        id: 'estimate-sum-diff',
        name: 'Estimate Sums & Differences',
        label: '≈ Estimate Sums/Differences',
        description: 'Estimate sums and differences by rounding',
      },
      {
        id: 'add-sub-word-problems',
        name: 'Add/Subtract Word Problems',
        label: '📖 Word Problems (Add/Sub)',
        description: 'Solve word problems involving addition and subtraction',
        problemType: 'standard',
      },
    ],
  },

  // Multiplication
  'multiplication': {
    category: 'C. Multiplication',
    categoryId: 'multiply',
    skills: [
      {
        id: 'long-multiplication',
        name: 'Long Multiplication (2-digit)',
        label: '✖️ Long Multiplication',
        description: 'Multiply 2-digit by 2-digit numbers using column method',
        problemType: 'column-method',
      },
      {
        id: 'multiply-powers-of-ten',
        name: 'Multiply by Powers of Ten',
        label: '✖️ × Powers of 10',
        description: 'Multiply whole numbers by powers of 10',
      },
      {
        id: 'estimate-products',
        name: 'Estimate Products',
        label: '≈ Estimate Products',
        description: 'Estimate multiplication results by rounding',
      },
      {
        id: 'multiply-word-problems',
        name: 'Multiplication Word Problems',
        label: '📖 Word Problems (Multiply)',
        description: 'Solve multiplication word problems with context',
        problemType: 'standard',
      },
    ],
  },

  // Division
  'division': {
    category: 'D. Division',
    categoryId: 'divide',
    skills: [
      {
        id: 'long-division',
        name: 'Long Division',
        label: '➗ Long Division',
        description: 'Divide multi-digit numbers by 1-digit and 2-digit divisors',
        problemType: 'column-method',
      },
      {
        id: 'divide-powers-of-ten',
        name: 'Divide by Powers of Ten',
        label: '➗ ÷ Powers of 10',
        description: 'Divide whole numbers by powers of 10',
      },
      {
        id: 'estimate-quotients',
        name: 'Estimate Quotients',
        label: '≈ Estimate Quotients',
        description: 'Estimate division results by rounding',
      },
      {
        id: 'interpret-remainders',
        name: 'Interpret Remainders',
        label: '📊 Remainders in Context',
        description: 'Understand meaning of remainders in word problems',
      },
      {
        id: 'divide-word-problems',
        name: 'Division Word Problems',
        label: '📖 Word Problems (Divide)',
        description: 'Solve division word problems with context',
        problemType: 'standard',
      },
    ],
  },

  // Fractions
  'fractions': {
    category: 'E. Fractions',
    categoryId: 'fractions',
    skills: [
      {
        id: 'equiv-fractions',
        name: 'Equivalent Fractions',
        label: '🔀 Equivalent Fractions',
        description: 'Find and identify equivalent fractions',
      },
      {
        id: 'simplify-fractions',
        name: 'Simplify Fractions',
        label: '📉 Simplify to Lowest Terms',
        description: 'Reduce fractions to simplest form',
      },
      {
        id: 'compare-fractions',
        name: 'Compare Fractions',
        label: '⚖️ Compare Fractions',
        description: 'Use <, =, > to compare fractions with unlike denominators',
      },
      {
        id: 'mixed-improper',
        name: 'Mixed Numbers & Improper Fractions',
        label: '↔️ Mixed ⟷ Improper',
        description: 'Convert between mixed numbers and improper fractions',
      },
      {
        id: 'add-fractions-unlike',
        name: 'Add Fractions (Unlike Denominators)',
        label: '➕ Add Fractions',
        description: 'Add fractions with different denominators',
      },
      {
        id: 'subtract-fractions-unlike',
        name: 'Subtract Fractions (Unlike Denominators)',
        label: '➖ Subtract Fractions',
        description: 'Subtract fractions with different denominators',
      },
      {
        id: 'add-mixed-numbers',
        name: 'Add Mixed Numbers',
        label: '➕ Add Mixed Numbers',
        description: 'Add mixed numbers with regrouping',
      },
      {
        id: 'subtract-mixed-numbers',
        name: 'Subtract Mixed Numbers',
        label: '➖ Subtract Mixed Numbers',
        description: 'Subtract mixed numbers with borrowing',
      },
      {
        id: 'multiply-fractions',
        name: 'Multiply Fractions',
        label: '✖️ Multiply Fractions',
        description: 'Multiply fractions and whole numbers',
      },
      {
        id: 'divide-fractions',
        name: 'Divide Fractions',
        label: '➗ Divide Fractions',
        description: 'Divide unit fractions and whole numbers',
      },
      {
        id: 'fractions-word-problems',
        name: 'Fraction Word Problems',
        label: '📖 Word Problems (Fractions)',
        description: 'Solve multi-step word problems with fractions',
        problemType: 'standard',
      },
    ],
  },

  // Decimals
  'decimals': {
    category: 'F. Decimals',
    categoryId: 'decimals',
    skills: [
      {
        id: 'decimal-place-value',
        name: 'Decimal Place Value',
        label: '📍 Decimal Place Value',
        description: 'Tenths, hundredths, thousandths place values',
      },
      {
        id: 'compare-decimals',
        name: 'Compare Decimals',
        label: '⚖️ Compare Decimals',
        description: 'Use <, =, > to compare decimal numbers',
      },
      {
        id: 'round-decimals',
        name: 'Round Decimals',
        label: '🔄 Round Decimals',
        description: 'Round decimals to nearest whole, tenth, hundredth',
      },
      {
        id: 'convert-fractions-decimals',
        name: 'Convert Fractions ↔ Decimals',
        label: '↔️ Fractions ⟷ Decimals',
        description: 'Convert between fractions and decimal notation',
      },
      {
        id: 'add-decimals',
        name: 'Add Decimals',
        label: '➕ Add Decimals',
        description: 'Add decimal numbers with column alignment',
        problemType: 'column-method',
      },
      {
        id: 'subtract-decimals',
        name: 'Subtract Decimals',
        label: '➖ Subtract Decimals',
        description: 'Subtract decimal numbers with column alignment',
        problemType: 'column-method',
      },
      {
        id: 'multiply-decimals',
        name: 'Multiply Decimals',
        label: '✖️ Multiply Decimals',
        description: 'Multiply decimals by whole numbers and decimals',
      },
      {
        id: 'divide-decimals',
        name: 'Divide Decimals',
        label: '➗ Divide Decimals',
        description: 'Divide decimals by whole numbers',
      },
      {
        id: 'decimals-word-problems',
        name: 'Decimal Word Problems',
        label: '📖 Word Problems (Decimals)',
        description: 'Solve real-world problems with decimal money/measurement',
        problemType: 'standard',
      },
    ],
  },

  // Order of Operations & Expressions
  'operations': {
    category: 'G. Expressions And Order Of Operations',
    categoryId: 'operations',
    skills: [
      {
        id: 'order-of-operations',
        name: 'Order of Operations (PEMDAS)',
        label: '⚙️ PEMDAS / Order of Operations',
        description: 'Evaluate expressions using correct order of operations',
      },
      {
        id: 'numeric-expressions',
        name: 'Write & Evaluate Numeric Expressions',
        label: '📝 Write Expressions',
        description: 'Translate word phrases to numeric expressions',
      },
    ],
  },

  // Factors & Multiples
  'factors-multiples': {
    category: 'H. Factors, Multiples And Number Theory',
    categoryId: 'factors',
    skills: [
      {
        id: 'identify-factors',
        name: 'Identify Factors',
        label: '🔍 Find Factors',
        description: 'List all factors of a given number',
      },
      {
        id: 'identify-multiples',
        name: 'Identify Multiples',
        label: '🔢 Find Multiples',
        description: 'List multiples of a number',
      },
      {
        id: 'prime-composite',
        name: 'Prime & Composite Numbers',
        label: '🔢 Prime vs Composite',
        description: 'Classify numbers as prime or composite',
      },
      {
        id: 'divisibility-rules',
        name: 'Divisibility Rules',
        label: '⚙️ Divisibility Rules',
        description: 'Apply divisibility rules for 2, 5, 10, etc.',
      },
      {
        id: 'lcm-gcd',
        name: 'GCF & LCM',
        label: '🔗 GCF & LCM',
        description: 'Find greatest common factor and least common multiple',
      },
    ],
  },

  // Measurement & Units
  'measurement': {
    category: 'I. Measurement',
    categoryId: 'measurement',
    skills: [
      {
        id: 'customary-units',
        name: 'Customary Units (Length, Weight, Volume)',
        label: '📏 Customary Units',
        description: 'Convert between inches, feet, yards, etc.',
      },
      {
        id: 'metric-units',
        name: 'Metric Units (Length, Mass, Volume)',
        label: '📐 Metric Units',
        description: 'Convert between millimeters, centimeters, meters, etc.',
      },
      {
        id: 'time-money',
        name: 'Time & Money',
        label: '⏰💵 Time & Money',
        description: 'Convert time units, count money, calculate change',
      },
    ],
  },

  // Geometry
  'geometry': {
    category: 'J. Geometry',
    categoryId: 'geometry',
    skills: [
      {
        id: 'classify-shapes',
        name: 'Classify Shapes',
        label: '🔺 Classify Shapes',
        description: 'Identify and classify triangles and quadrilaterals',
      },
      {
        id: 'perimeter',
        name: 'Perimeter',
        label: '📏 Perimeter',
        description: 'Calculate perimeter of polygons',
      },
      {
        id: 'area',
        name: 'Area',
        label: '📐 Area',
        description: 'Calculate area of rectangles and compound figures',
      },
      {
        id: 'volume',
        name: 'Volume',
        label: '📦 Volume',
        description: 'Calculate volume of rectangular prisms and cubes',
      },
    ],
  },

  // Data & Patterns
  'data-patterns': {
    category: 'K. Data, Graphs And Patterns',
    categoryId: 'data',
    skills: [
      {
        id: 'number-patterns',
        name: 'Number Patterns',
        label: '🔀 Find Patterns',
        description: 'Identify and extend number sequences and patterns',
      },
      {
        id: 'data-analysis',
        name: 'Data Analysis (Mean, Median, Mode, Range)',
        label: '📊 Mean, Median, Mode, Range',
        description: 'Calculate and interpret statistical measures',
      },
      {
        id: 'line-graphs',
        name: 'Interpret & Create Graphs',
        label: '📈 Graphs & Line Plots',
        description: 'Read and create line plots, bar graphs, line graphs',
      },
    ],
  },

  // Algebra Readiness
  'algebra': {
    category: 'L. Algebra And Coordinate Plane',
    categoryId: 'algebra',
    skills: [
      {
        id: 'variables',
        name: 'Variables & Expressions',
        label: '✖️ Variables & Expressions',
        description: 'Evaluate expressions with variables',
      },
      {
        id: 'equations',
        name: 'Solve Simple Equations',
        label: '⚖️ Solve Equations',
        description: 'Solve one-step and two-step equations',
      },
      {
        id: 'coordinate-plane',
        name: 'Coordinate Plane',
        label: '📍 Coordinate Plane',
        description: 'Plot and identify points on coordinate grid',
      },
    ],
  },
}

/**
 * Get a skill by ID across all categories
 */
export function getSkillById(skillId) {
  for (const category of Object.values(MATH_SKILLS_CATALOG)) {
    for (const skill of category.skills) {
      if (skill.id === skillId) {
        return { ...skill, categoryId: category.categoryId }
      }
    }
  }
  return null
}

/**
 * Get all skills in a category
 */
export function getSkillsByCategory(categoryId) {
  const categoryEntry = Object.values(MATH_SKILLS_CATALOG).find(
    (cat) => cat.categoryId === categoryId
  )
  return categoryEntry?.skills || []
}

/**
 * Get all categories
 */
export function getAllCategories() {
  return Object.entries(MATH_SKILLS_CATALOG).map(([key, data]) => ({
    id: data.categoryId,
    name: data.category,
    skillCount: data.skills.length,
  }))
}
