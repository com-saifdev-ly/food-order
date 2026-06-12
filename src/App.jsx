import './App.css';

function App() {
  return (
    <div className="App">
      <main className="App-shell">
        <section className="Hero-card">
          <p className="Eyebrow">Order and pick up food for your family</p>
          <h1>Welcome to Food Order</h1>

          <div className="Action-row">
            <button type="button" className="Primary-btn" onClick={(event) => event.preventDefault()}>
              Download the app
            </button>
          </div>

          <div className="Download-grid">
            <button type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
              Windows
            </button>
            <button type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
              Linux
            </button>
            <button type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
              Mac
            </button>
            <button type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
              iOS
            </button>
            <button type="button" className="Download-btn" onClick={(event) => event.preventDefault()}>
              Android
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
