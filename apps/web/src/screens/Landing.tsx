// Landing screen (skeleton). A sub-agent will polish the visuals into screens.css.
// Contract: render a hero and call onGetStarted / onGuest. Keep these props stable.
export function Landing({
  onGetStarted,
  onGuest,
}: {
  onGetStarted: () => void;
  onGuest: () => void;
}) {
  return (
    <main className="screen landing">
      <div className="screen-card glass-panel">
        <span className="screen-badge">◍ NearPast</span>
        <h1>History happens where you're standing.</h1>
        <p>
          Walk up to a place and talk to the person who made it famous. Their voice,
          their story, right where it happened — then keep a sticker of every spot you unlock.
        </p>
        <div className="screen-actions">
          <button className="primary-button" type="button" onClick={onGetStarted}>
            Get started
          </button>
          <button className="secondary-button" type="button" onClick={onGuest}>
            Explore as guest
          </button>
        </div>
      </div>
    </main>
  );
}
