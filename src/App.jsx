import React, { useEffect, useRef, useState } from 'react';
import { MoonpetalGame } from './game.js';

const initialUI = {
  phase: 'title',
  stageName: 'Petal Shrine',
  stageNumber: 1,
  stageRealm: 'Moonlit sanctuary',
  accent: '#ff8eb9',
  time: '00:00',
  totalTime: '00:00',
  hp: 5,
  maxHp: 5,
  xp: 0,
  xpNeeded: 6,
  level: 1,
  auto: true,
  kills: 0,
  boss: false,
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  toast: '',
  choices: [],
};

function PauseMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5.5 4.5v9M12.5 4.5v9" />
    </svg>
  );
}

function PlayMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="m6 4.5 7 4.5-7 4.5z" />
    </svg>
  );
}

function PrimaryButton({ children, onClick, className = '' }) {
  return (
    <button className={`primary-button ${className}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [ui, setUI] = useState(initialUI);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    const game = new MoonpetalGame(canvasRef.current, setUI);
    gameRef.current = game;
    game.load()
      .then(() => { if (active) setReady(true); })
      .catch((error) => { if (active) setLoadError(error.message); });

    return () => {
      active = false;
      game.destroy();
      if (gameRef.current === game) gameRef.current = null;
    };
  }, []);

  const xpPercent = ui.xpNeeded ? Math.min(100, (ui.xp / ui.xpNeeded) * 100) : 0;
  const bossPercent = ui.bossMaxHp ? Math.max(0, (ui.bossHp / ui.bossMaxHp) * 100) : 0;
  const showHud = ui.phase !== 'title';

  return (
    <main className="game-shell" style={{ '--realm-accent': ui.accent }}>
      <canvas ref={canvasRef} className="game-canvas" aria-label="Moonpetal game arena" />

      {!ready && !loadError && (
        <div className="loading-screen" role="status">Opening the moon gate…</div>
      )}
      {loadError && <div className="loading-screen" role="alert">{loadError}</div>}

      {showHud && ready && (
        <>
          <section className="hud-top" aria-label="Run status">
            <div className="health-block hud-glass">
              <div className="hearts" aria-label={`${Math.ceil(ui.hp)} of ${ui.maxHp} hearts`}>
                {Array.from({ length: ui.maxHp }, (_, index) => (
                  <span className={`heart ${index < Math.ceil(ui.hp) ? 'heart-full' : ''}`} key={index}>
                    ♥
                  </span>
                ))}
              </div>
            </div>

            <div className="stage-status" aria-live="polite">
              <div className="stage-knot"><span>✿</span> STAGE {ui.stageNumber} / 3 <span>✿</span></div>
              <div className="stage-name">{ui.stageName}</div>
              <div className="stage-clock">{ui.time}</div>
              <div className="xp-row">
                <span className="level-label">LV {String(ui.level).padStart(2, '0')}</span>
                <div className="xp-track" aria-label={`Level progress ${Math.round(xpPercent)} percent`}>
                  <span style={{ width: `${xpPercent}%` }} />
                </div>
                <span className="xp-label">MOON XP</span>
              </div>
            </div>

            <div className="action-controls">
              <button
                className={`auto-button ${ui.auto ? 'is-on' : ''}`}
                type="button"
                aria-pressed={ui.auto}
                onClick={() => gameRef.current?.toggleAuto()}
                disabled={ui.phase !== 'playing'}
              >
                <span className="auto-spark">✦</span>
                <span className="auto-copy">
                  <strong>AUTO {ui.auto ? 'ON' : 'OFF'}</strong>
                  <small>SPACE</small>
                </span>
              </button>
              <button
                className="pause-button hud-glass"
                type="button"
                aria-label={ui.phase === 'paused' ? 'Resume game' : 'Pause game'}
                onClick={() => gameRef.current?.togglePause()}
                disabled={!['playing', 'paused'].includes(ui.phase)}
              >
                {ui.phase === 'paused' ? <PlayMark /> : <PauseMark />}
              </button>
            </div>
          </section>

          {ui.boss && (
            <div className="boss-meter" aria-live="polite">
              <div className="boss-name">✦ {ui.bossName} ✦</div>
              <div className="boss-track"><span style={{ width: `${bossPercent}%` }} /></div>
            </div>
          )}

          {ui.toast && ui.phase === 'playing' && (
            <div className="guardian-toast" role="status">{ui.toast}</div>
          )}

          <section className="bottom-hud" aria-label="Controls">
            <div className="movement-hint hud-glass">
              <div className="key-cluster" aria-hidden="true">
                <kbd>W</kbd>
                <div><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
              </div>
              <span>MOVE</span>
            </div>
          </section>
        </>
      )}

      {ready && ui.phase === 'title' && (
        <section className="title-overlay" aria-label="Moonpetal title screen">
          <div className="title-copy">
            <div className="title-emblem" aria-hidden="true"><span>✿</span></div>
            <h1>Moonpetal</h1>
            <p className="title-subtitle">A little magic goes a long way.</p>
            <p className="title-description">Guide Mina through three dreamworlds and send the spirit tide home.</p>
            <PrimaryButton onClick={() => gameRef.current?.startRun()}>
              Begin your run <span className="button-star">✦</span>
            </PrimaryButton>
            <div className="title-instructions">
              <div><span className="instruction-mark">WASD</span><span>to move</span></div>
              <div><span className="instruction-mark">SPACE</span><span>toggle auto attack</span></div>
            </div>
            <div className="title-footnote"><span>✧</span> Three stages · Three guardians <span>✧</span></div>
          </div>
          <div className="title-character-glow" aria-hidden="true" />
        </section>
      )}

      {ready && ui.phase === 'paused' && (
        <section className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <div className="overlay-card pause-card">
            <div className="overlay-emblem">Ⅱ</div>
            <h2 id="pause-title">Take a little breath</h2>
            <p>Your moonlit run is paused.</p>
            <PrimaryButton onClick={() => gameRef.current?.resume()}>Back to the garden</PrimaryButton>
            <span className="overlay-shortcut">Press <kbd>ESC</kbd> to return</span>
          </div>
        </section>
      )}

      {ready && ui.phase === 'upgrade' && (
        <section className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
          <div className="overlay-card upgrade-card">
            <div className="overlay-emblem bloom">✿</div>
            <h2 id="upgrade-title">A new charm blooms</h2>
            <p>Choose one gift for the journey ahead.</p>
            <div className="upgrade-grid">
              {ui.choices.map((choice, index) => (
                <button className="upgrade-option" key={choice.id} type="button" onClick={() => gameRef.current?.chooseUpgrade(index)}>
                  <span className="choice-number">{index + 1}</span>
                  <span className="choice-icon">{choice.icon}</span>
                  <strong>{choice.name}</strong>
                  <span className="choice-description">{choice.description}</span>
                  <span className="choice-level">CHARM LV {choice.level}</span>
                </button>
              ))}
            </div>
            <span className="overlay-shortcut">Choose with <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span>
          </div>
        </section>
      )}

      {ready && ui.phase === 'transition' && (
        <section className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="transition-title">
          <div className="overlay-card transition-card">
            <div className="overlay-emblem bloom">✦</div>
            <p className="transition-kicker">GUARDIAN DEFEATED</p>
            <h2 id="transition-title">The path opens</h2>
            <p>One more heart for Mina. A new dreamworld is waiting.</p>
            <PrimaryButton onClick={() => gameRef.current?.continueStage()}>Enter the next stage <span className="button-star">✦</span></PrimaryButton>
            <span className="overlay-shortcut">Or press <kbd>ENTER</kbd></span>
          </div>
        </section>
      )}

      {ready && ui.phase === 'gameover' && (
        <section className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
          <div className="overlay-card result-card">
            <div className="overlay-emblem">♡</div>
            <h2 id="gameover-title">The spirits got the best of you</h2>
            <p>Mina made it to <strong>{ui.stageName}</strong>. Every run makes your magic brighter.</p>
            <div className="result-stats"><span><strong>{ui.kills}</strong><small>SPIRITS SENT HOME</small></span><span><strong>{ui.totalTime}</strong><small>TIME IN THE DREAM</small></span></div>
            <PrimaryButton onClick={() => gameRef.current?.startRun()}>Try another run <span className="button-star">✦</span></PrimaryButton>
            <span className="overlay-shortcut">Press <kbd>ENTER</kbd> to play again</span>
          </div>
        </section>
      )}

      {ready && ui.phase === 'victory' && (
        <section className="screen-overlay" role="dialog" aria-modal="true" aria-labelledby="victory-title">
          <div className="overlay-card result-card victory-card">
            <div className="overlay-emblem bloom">✿</div>
            <h2 id="victory-title">The dreamworlds are safe!</h2>
            <p>Mina's star magic brought the moonlit realms back to life.</p>
            <div className="result-stats"><span><strong>{ui.kills}</strong><small>SPIRITS SENT HOME</small></span><span><strong>{ui.totalTime}</strong><small>TIME IN THE DREAM</small></span></div>
            <PrimaryButton onClick={() => gameRef.current?.startRun()}>Play again <span className="button-star">✦</span></PrimaryButton>
            <span className="overlay-shortcut">Press <kbd>ENTER</kbd> for another run</span>
          </div>
        </section>
      )}
    </main>
  );
}
