import { useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || ''

async function postAuth(path, payload) {
  const response = await fetch(`${API_URL}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let result
  try {
    result = await response.json()
  } catch {
    throw new Error('The server returned an unexpected response.')
  }

  if (!response.ok) {
    throw new Error(result.message || 'The request could not be completed.')
  }

  return result
}

function App() {
  const [stage, setStage] = useState('signup')
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSignup(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await postAuth('signup', form)
      setStage('email')
      setNotice(result.message)

      try {
        const emailResult = await postAuth('send-email-otp', {
          email: form.email,
        })
        setOtpSent(true)
        setNotice(emailResult.message)
      } catch (sendError) {
        setError(`Your account was created, but the email code could not be sent. ${sendError.message}`)
      }
    } catch (signupError) {
      setError(signupError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSendCode(channel) {
    setBusy(true)
    setError('')
    setNotice('')
    setOtp('')

    try {
      const result = await postAuth(`send-${channel}-otp`, {
        [channel]: channel === 'email' ? form.email : form.phone,
      })
      setOtpSent(true)
      setNotice(result.message)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(event, channel) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    try {
      const result = await postAuth(`verify-${channel}-otp`, {
        [channel]: channel === 'email' ? form.email : form.phone,
        otp,
      })
      setNotice(result.message)
      setOtp('')
      setOtpSent(false)
      setStage(channel === 'email' ? 'phone' : 'done')
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setBusy(false)
    }
  }

  const steps = ['signup', 'email', 'phone']
  const activeStep = stage === 'done' ? steps.length : steps.indexOf(stage)

  return (
    <main className="page-shell">
      <section className="verification-card" aria-labelledby="page-title">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>Verifyly</span>
        </header>

        <div className="card-content">
          {stage !== 'done' && (
            <ol className="progress" aria-label="Verification progress">
              {steps.map((step, index) => (
                <li
                  className={index <= activeStep ? 'progress-step active' : 'progress-step'}
                  key={step}
                >
                  <span>{index + 1}</span>
                  <span>{step === 'signup' ? 'Account' : step === 'email' ? 'Email' : 'Phone'}</span>
                </li>
              ))}
            </ol>
          )}

          {stage === 'signup' && (
            <>
              <div className="eyebrow">GET STARTED</div>
              <h1 id="page-title">Create your account</h1>
              <p className="intro">Add your details and we’ll help you verify your email and phone.</p>
              <form className="form" onSubmit={handleSignup}>
                <label>
                  Full name
                  <input
                    autoComplete="name"
                    name="name"
                    onChange={updateField}
                    placeholder="Jane Smith"
                    required
                    value={form.name}
                  />
                </label>
                <label>
                  Email address
                  <input
                    autoComplete="email"
                    name="email"
                    onChange={updateField}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={form.email}
                  />
                </label>
                <label>
                  Phone number
                  <input
                    autoComplete="tel"
                    name="phone"
                    onChange={updateField}
                    pattern="^\+[1-9][0-9]{7,14}$"
                    placeholder="+14155552671"
                    required
                    title="Use an international number with country code, such as +14155552671."
                    type="tel"
                    value={form.phone}
                  />
                  <span className="field-hint">Include your country code, for example +14155552671.</span>
                </label>
                <label>
                  Password
                  <input
                    autoComplete="new-password"
                    minLength="8"
                    name="password"
                    onChange={updateField}
                    placeholder="At least 8 characters"
                    required
                    type="password"
                    value={form.password}
                  />
                </label>
                <button className="primary-button" disabled={busy} type="submit">
                  {busy ? 'Creating account…' : 'Create account'}
                </button>
              </form>
            </>
          )}

          {stage === 'email' && (
            <>
              <div className="eyebrow">STEP 1 OF 2</div>
              <h1 id="page-title">Check your email</h1>
              <p className="intro">
                Enter the 6-digit code sent to <strong>{form.email}</strong>. It expires in 5 minutes.
              </p>
              <form className="form" onSubmit={(event) => handleVerify(event, 'email')}>
                <label>
                  Email verification code
                  <input
                    autoComplete="one-time-code"
                    autoFocus
                    inputMode="numeric"
                    maxLength="6"
                    minLength="6"
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    pattern="[0-9]{6}"
                    placeholder="000000"
                    required
                    value={otp}
                  />
                </label>
                <button className="primary-button" disabled={busy || !otpSent} type="submit">
                  {busy ? 'Verifying…' : 'Verify email'}
                </button>
              </form>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => handleSendCode('email')}
                type="button"
              >
                {otpSent ? 'Resend code' : 'Send email code'}
              </button>
            </>
          )}

          {stage === 'phone' && (
            <>
              <div className="eyebrow">STEP 2 OF 2</div>
              <h1 id="page-title">Verify your phone</h1>
              <p className="intro">
                Your email is verified. Send a text code to <strong>{form.phone}</strong> to finish setup.
              </p>
              {!otpSent ? (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => handleSendCode('phone')}
                  type="button"
                >
                  {busy ? 'Sending code…' : 'Send phone code'}
                </button>
              ) : (
                <>
                  <form className="form" onSubmit={(event) => handleVerify(event, 'phone')}>
                    <label>
                      Phone verification code
                      <input
                        autoComplete="one-time-code"
                        autoFocus
                        inputMode="numeric"
                        maxLength="6"
                        minLength="6"
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                        pattern="[0-9]{6}"
                        placeholder="000000"
                        required
                        value={otp}
                      />
                    </label>
                    <button className="primary-button" disabled={busy} type="submit">
                      {busy ? 'Verifying…' : 'Verify phone'}
                    </button>
                  </form>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => handleSendCode('phone')}
                    type="button"
                  >
                    Resend code
                  </button>
                </>
              )}
            </>
          )}

          {stage === 'done' && (
            <div className="complete-state">
              <div className="success-icon" aria-hidden="true">✓</div>
              <div className="eyebrow">ALL SET</div>
              <h1 id="page-title">You’re verified</h1>
              <p className="intro">Your email and phone number have both been verified.</p>
            </div>
          )}

          {error && <p className="feedback error" role="alert">{error}</p>}
          {notice && !error && <p className="feedback notice" role="status">{notice}</p>}
        </div>

        <footer className="card-footer">
          <span className="lock-icon" aria-hidden="true">▣</span>
          Your information is securely handled.
        </footer>
      </section>
      <p className="page-note">Verification codes are single-use and expire after 5 minutes.</p>
    </main>
  )
}

export default App
