/**
 * Plain-language plans, shown before sign-up so nobody has to start a trial to
 * learn what it costs. Draft copy: confirm the plan details before launch.
 */
export function Pricing() {
  return (
    <section className="plans" aria-label="Pricing">
      <h2>Simple, upfront pricing</h2>
      <div className="plan-grid">
        <div className="plan">
          <h3>Free</h3>
          <p className="plan-price">$0, no card, no trial clock</p>
          <ul>
            <li>Full zero-based budgeting</li>
            <li>Manual entry and CSV import</li>
            <li>Shared budgets with owner, editor and viewer roles</li>
          </ul>
        </div>
        <div className="plan">
          <h3>Bank sync (planned)</h3>
          <p className="plan-price">Optional add-on</p>
          <ul>
            <li>Price shown before you connect an account</li>
            <li>Cancel any time; your budget stays free</li>
            <li>Budgeting never depends on a connection</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
