// All of the site's words and links live here, so updating content never means touching layout code.

export const links = {
  email: 'griffinhaag00@gmail.com',
  github: 'https://github.com/griffinhaag',
  linkedin: 'https://www.linkedin.com/in/griffin-haag-8034252b2',
  resume: '/griffin-haag-resume.pdf',
  games: 'https://griffinhgames.xyz',
};

export type Job = {
  when: string;
  title: string;
  org: string;
  where?: string;
  points: string[];
};

export const experience: Job[] = [
  {
    when: '2026 – present',
    title: 'B.S. in Computer Science',
    org: 'University of Minnesota',
    where: 'Minneapolis, MN',
    points: ['Taking classes alongside my job at KorTerra.'],
  },
  {
    when: '2025 – present',
    title: 'Software Developer',
    org: 'KorTerra',
    where: 'Chanhassen, MN, part-time',
    points: [
      'Build and maintain server-side applications in C# and .NET.',
      'Configure Azure infrastructure with Terraform.',
      'Contribute to REST APIs, microservices, and Kubernetes workloads.',
      'Support SQL and NoSQL databases, including Azure Cosmos DB caching.',
    ],
  },
  {
    when: '2024',
    title: 'Python Instructor',
    org: 'iD Tech Camps at Macalester College',
    where: 'St. Paul, MN',
    points: [
      'Taught Python at the same camp where I learned to code.',
      'Built a chatbot on the OpenAI API so campers could get unstuck while I was helping someone else.',
    ],
  },
  {
    when: '2023 – present',
    title: 'Freelance Web Developer',
    org: 'Client work',
    points: [
      'Designed and built the websites for SheShuttle, a private taxi service, and SendMeAPostcard, a travel agency.',
    ],
  },
  {
    when: '2023 – 2025',
    title: 'A.A.S. in Web Programming & Database Development',
    org: 'Dunwoody College of Technology',
    where: 'Minneapolis, MN',
    points: ['Graduated with a 3.3 GPA and made the Dean’s List. My capstone project was DayONE.'],
  },
];

export const origins = [
  {
    when: '2013 – 2020',
    text: 'Went to my first iD Tech camp at 9 and kept going back for eight summers, starting with Scratch and working up to C++ and Java.',
  },
  {
    when: '2018 – 2022',
    text: 'Took computer science and UX design classes at Minnetonka High School.',
  },
  {
    when: 'Scouting',
    text: 'Built and ran my Boy Scout troop’s website, and earned the rank of Eagle Scout.',
  },
];

export type Build = {
  name: string;
  blurb: string;
  stack: string[];
  href?: string;
  linkLabel?: string;
};

// Smaller projects, one line each. The ones with code to look at come first.
// Pure homework is left out on purpose.
export const builds: Build[] = [
  {
    name: 'CI/CD pipeline',
    blurb: 'A Jenkins pipeline that scans, builds, and redeploys a Node chat app in Docker.',
    stack: ['Jenkins', 'Docker', 'Snyk', 'SonarQube'],
    href: 'https://github.com/griffinhaag/realtime-chat-docker',
  },
  {
    name: 'PHP e-commerce store',
    blurb: 'An online store in plain PHP with user roles, a cart, checkout, and an admin side.',
    stack: ['PHP', 'MySQL', 'JavaScript'],
    href: 'https://github.com/griffinhaag/php-ecommerce-store',
  },
  {
    name: 'GadgetHub',
    blurb: 'An ASP.NET MVC electronics store with a session cart, emailed orders, and an admin area.',
    stack: ['C#', 'ASP.NET MVC', 'SQL'],
    href: 'https://github.com/griffinhaag/gadgethub-store',
  },
  {
    name: 'Virtual Pet API',
    blurb: 'A Spring Boot API for a pet named Gribble, who has strong opinions about toys.',
    stack: ['Java', 'Spring Boot'],
    href: 'https://github.com/griffinhaag/virtual-pet-api',
  },
  {
    name: 'Budget Buddy',
    blurb: 'A personal finance tracker for logging and searching transactions and receipts.',
    stack: ['React', 'Node.js', 'MongoDB'],
  },
  {
    name: 'Classroom chatbot',
    blurb: 'Gave my iD Tech students somewhere to ask questions while I was helping someone else.',
    stack: ['Python', 'OpenAI API'],
  },
  {
    name: 'Image and webcam recognition',
    blurb: 'Recognizes objects in photos and in a live webcam feed.',
    stack: ['Python', 'Machine learning'],
  },
  {
    name: 'Data analytics tool',
    blurb: 'Turns spreadsheets and SQL results into the chart that fits the data.',
    stack: ['Python', 'SQL', 'Excel'],
  },
  {
    name: 'Movie generator',
    blurb: 'Describe what you’re in the mood for, and it suggests a movie from IMDb data.',
    stack: ['JavaScript', 'IMDb API'],
  },
];

export const clients = [
  { name: 'SendMeAPostcard', what: 'Travel agency', href: 'https://sendmeapostcardmn.com' },
  { name: 'SheShuttle', what: 'Private taxi service' },
];

// Each tool lists where it was used, so the toolbox can show it.
export const toolbox: { group: string; tools: { name: string; used: string[] }[] }[] = [
  {
    group: 'At work',
    tools: [
      { name: 'C# / .NET', used: ['KorTerra', 'GadgetHub'] },
      { name: 'Azure', used: ['KorTerra'] },
      { name: 'Terraform', used: ['KorTerra'] },
      { name: 'Kubernetes', used: ['KorTerra'] },
      { name: 'Cosmos DB', used: ['KorTerra'] },
      { name: 'REST APIs', used: ['KorTerra', 'Virtual Pet API', 'GriffinGames'] },
    ],
  },
  {
    group: 'On the web',
    tools: [
      { name: 'JavaScript', used: ['GriffinGames', 'DayONE', 'Movie generator', 'Client sites'] },
      { name: 'Node.js', used: ['GriffinGames', 'Budget Buddy'] },
      { name: 'Socket.IO', used: ['GriffinGames'] },
      { name: 'React', used: ['Budget Buddy'] },
      { name: 'PHP', used: ['PHP e-commerce store'] },
      { name: 'HTML & CSS', used: ['Everything here', 'Client sites'] },
      { name: 'Tailwind', used: ['Budget Buddy', 'This site'] },
    ],
  },
  {
    group: 'Languages & data',
    tools: [
      { name: 'Python', used: ['Classroom chatbot', 'Recognition tool', 'Data analytics tool', 'Teaching at iD Tech'] },
      { name: 'Java', used: ['Virtual Pet API'] },
      { name: 'SQL', used: ['KorTerra', 'GadgetHub', 'PHP e-commerce store'] },
      { name: 'MySQL', used: ['PHP e-commerce store'] },
      { name: 'MongoDB', used: ['Budget Buddy'] },
      { name: 'LLM APIs', used: ['GriffinGames', 'Classroom chatbot'] },
    ],
  },
  {
    group: 'Deploying',
    tools: [
      { name: 'Docker', used: ['CI/CD pipeline', 'Containerized static sites on Docker Hub'] },
      { name: 'Jenkins', used: ['CI/CD pipeline'] },
      { name: 'GitHub Actions', used: ['GriffinGames server'] },
      { name: 'AWS', used: ['DayONE', 'Certified Cloud Practitioner'] },
      { name: 'Render & Netlify', used: ['GriffinGames'] },
      { name: 'Git', used: ['Everything here'] },
    ],
  },
];

export const facts = [
  'Eagle Scout',
  'Fluent in Spanish',
  'AWS Certified Cloud Practitioner',
  'Writing code since I was 9',
];
