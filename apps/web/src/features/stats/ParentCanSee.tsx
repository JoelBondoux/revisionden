import { Card } from '../../components/Card';

/** Children's Code transparency: the student sees exactly which stats their parent can see. */
export function ParentCanSee() {
  return (
    <Card title="What your parent can see">
      <ul className="link-list">
        <li>Study time, plan sessions kept, accuracy and your streak</li>
        <li>Mastery and change for each subject, and your three weakest topics</li>
        <li>Sessions in quiet hours, days at the daily limit and rest days</li>
        <li>Your daily limit and the minutes you have used today</li>
        <li>Predicted and target grades, school report effort scores and their reward for you</li>
        <li>How much of your AI marking allowance you have used this month</li>
        <li>Your last 10 activities (lessons, flashcards, tests), never your own words or cards</li>
      </ul>
      <p className="secondary-text">
        If your family has two parents set up, both of them can see the same things.
      </p>
    </Card>
  );
}
