import './App.css';

function readAuthParams(location) {
  const params = new URLSearchParams(location.search);
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const hashParams = new URLSearchParams(hash);

  hashParams.forEach((value, key) => {
    if (!params.has(key)) {
      params.set(key, value);
    }
  });

  return params;
}

export function getAuthCallbackState(location = window.location) {
  const params = readAuthParams(location);
  const error = params.get('error_description') || params.get('error');
  const type = params.get('type');
  const hasConfirmation = Boolean(
    params.get('code') ||
    params.get('access_token') ||
    params.get('token_hash') ||
    type === 'signup' ||
    type === 'email_change',
  );

  if (error) {
    return {
      status: 'error',
      title: 'Email confirmation failed',
      message: error.replace(/\+/g, ' '),
    };
  }

  if (hasConfirmation) {
    return {
      status: 'success',
      title: 'Email confirmed',
      message: 'Your email address has been verified. You can return to Food Order and sign in.',
    };
  }

  return {
    status: 'pending',
    title: 'Checking confirmation link',
    message: 'This page is ready for Supabase email confirmation links.',
  };
}

function AuthCallback() {
  const callbackState = getAuthCallbackState();

  return (
    <div className="App">
      <main className="App-shell">
        <section className={`Hero-card Callback-card Callback-card--${callbackState.status}`}>
          <p className="Eyebrow">Food Order account</p>
          <h1>{callbackState.title}</h1>
          <p className="Callback-message">{callbackState.message}</p>

          <div className="Action-row">
            <a className="Primary-btn" href="/">
              Back to Food Order
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

function HomePage() {
  return (
    <div className="App">
      <main className="App-shell">
        <section className="Hero-card">
          <p className="Eyebrow">Order and pick up food for your family and friends</p>
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

function App() {
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  return <HomePage />;
}

export default App;
