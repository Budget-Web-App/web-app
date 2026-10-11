import type { StepId } from './guide';

export interface Lesson {
  title: string;
  /** One or two sentences: why this step exists. */
  why: string;
  /** Short prompts for the decision the person is about to make. */
  think?: string[];
  good?: string[];
  bad?: string[];
}

/**
 * All teaching copy lives here, apart from the components, so it can be read
 * and edited as one document. Keep each line short and in plain language.
 */
export const LESSONS: Record<StepId, Lesson> = {
  welcome: {
    title: 'Give every dollar a job',
    why: 'Zero-based budgeting means each dollar you have gets a purpose before you spend it. What you have, minus what you plan, equals zero. It does not mean spending everything: saving is a job too.',
  },
  groups: {
    title: 'Start with a category group',
    why: 'Groups are folders for your categories. They keep the budget readable and add up each area of your life.',
    think: [
      'Group by how the money behaves: bills you must pay, everyday spending, savings goals.',
      'Three to five groups is plenty to start. You can rename or add more any time.',
      'Put what you pay first near the top, so the important jobs get funded first.',
    ],
  },
  categories: {
    title: 'Add categories: the jobs',
    why: 'A category is a job a dollar can do. When you spend, you pick the category, and the budget shows what is left for that job.',
    think: [
      'Name the purpose, not the store. You will spend at many places for one purpose.',
      'Be specific enough to act on. Dining out and Groceries behave differently, so keep them apart.',
      'Give true expenses their own category. Costs that are not monthly, like car insurance or gifts, get a little set aside each month so they never surprise you.',
      'Start small. Eight to twelve categories is enough. Split one later if it feels vague.',
    ],
    good: ['Groceries', 'Car insurance', 'Vacation', 'Fun money'],
    bad: ['Walmart', 'Misc', 'Stuff', 'Stuff I might need'],
  },
  accounts: {
    title: 'Add an account',
    why: 'Accounts are where your money actually sits. The budget tracks them so it always knows how much you really have to work with.',
    think: [
      'Add checking and savings first. That is the money you can give jobs to.',
      'A credit card is borrowed money. Spending on it still comes out of a category, so the budget stays honest.',
      'Use names you will recognise, like Chase Checking.',
      'Only add what you want to track. You can add more later.',
    ],
  },
  money: {
    title: 'Bring your money in',
    why: 'Ready to assign is money that has arrived but has no job yet. Recording what you have now, or a paycheck that landed, fills it.',
    think: [
      'Use real money: today\'s balance in your cash accounts, or income that already arrived.',
      'Do not count paychecks you expect. Add each one when it lands.',
      'A number that is a little off is fine. You can correct it later.',
    ],
  },
  assign: {
    title: 'Give every dollar a job',
    why: 'Now decide what each dollar is for. The goal is Ready to assign at zero. That means no unassigned money, not no money.',
    think: [
      'Fund what you must pay first: housing, utilities, food, transport.',
      'Then goals. An emergency fund is a job, and a good one.',
      'Plan some fun money. A realistic amount you can spend freely beats a plan you abandon.',
      'Plans change. You can move money between categories whenever life does.',
    ],
  },
  done: {
    title: 'You are set up',
    why: 'The setup is a one-time job. From here the budget is a habit: spend, record, adjust.',
  },
};

export const GROUP_IDEAS = ['Bills', 'Everyday spending', 'Savings goals', 'Fun'];

/** The four habits, in plain words, shown once setup ends. */
export const HABITS: { title: string; body: string }[] = [
  {
    title: 'Give every dollar a job',
    body: 'When money arrives, decide what it is for before you spend it.',
  },
  {
    title: 'Plan for true expenses',
    body: 'Spread the big, irregular costs over the months so a bill is never a surprise.',
  },
  {
    title: 'Roll with the punches',
    body: 'Overspent? Move money from another category with Cover it. The budget is a plan, and plans adjust.',
  },
  {
    title: 'Age your money',
    body: 'Work toward spending last month\'s income this month. That is how the paycheck-to-paycheck feeling ends.',
  },
];
