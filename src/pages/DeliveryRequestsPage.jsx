import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations, getDateLocale, getDateLocaleOptions } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getDeliveryIncomingRequests, respondToDeliveryRequest, cancelDeliveryRequest } from '../lib/database';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';
import { showConfirmDialog } from '../components/ConfirmDialog';

export default function DeliveryRequestsPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState({ requestId: null, status: null });
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState('');
  const [customerAvatars, setCustomerAvatars] = useState({});

  useEffect(() => {
    async function loadData() {
      if (!session) return;

      try {
        // Get user profile
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get incoming delivery requests
        const incomingRequests = await getDeliveryIncomingRequests(session.user.id);
        setRequests(incomingRequests);

        // Load customer avatars
        const avatarMap = {};
        for (const request of incomingRequests) {
          if (request.customer_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(request.customer_id);
              avatarMap[request.customer_id] = avatarUrl;
            } catch (error) {
              console.error('Error loading customer avatar:', error);
              avatarMap[request.customer_id] = '/assets/user.svg';
            }
          }
        }
        setCustomerAvatars(avatarMap);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  async function handleRespond(requestId, status) {
    setResponding({ requestId, status });
    try {
      await respondToDeliveryRequest(requestId, status);
      setMessage(status === 'accepted' ? copy.requestAccepted : copy.requestRejected);
      
      // Refresh requests
      const updatedRequests = await getDeliveryIncomingRequests(session.user.id);
      setRequests(updatedRequests);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.failedToRespond + error.message);
    } finally {
      setResponding({ requestId: null, status: null });
    }
  }

  async function handleCancelRequest(requestId) {
    const confirmed = await showConfirmDialog(copy.confirmCancelDeliveryRequest, language);
    if (!confirmed) return;

    setCancelling(requestId);
    try {
      await cancelDeliveryRequest(requestId);
      setMessage(copy.deliveryRequestCancelledSuccess);
      
      // Refresh requests
      const updatedRequests = await getDeliveryIncomingRequests(session.user.id);
      setRequests(updatedRequests);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.cancelRequestFailed + ': ' + error.message);
    } finally {
      setCancelling(null);
    }
  }

  function getStatusLabel(status) {
    const statusMap = {
      pending: copy.statusPending,
      accepted: copy.statusAccepted,
      rejected: copy.statusRejected,
    };
    return statusMap[status] || status;
  }

  function getStatusColor(status) {
    const colorMap = {
      pending: 'var(--status-pending)',
      accepted: 'var(--status-delivered)',
      rejected: 'var(--status-rejected)',
    };
    return colorMap[status] || 'var(--status-default)';
  }

  if (authLoading || loading) {
    return (
      <PageShell language={language}>
        <section className="Hero-card">

          <h1>{copy.loading}</h1>
        </section>
      </PageShell>
    );
  }

  if (!session || profile?.role !== 'delivery') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.incomingRequests}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'red' : 'green' }}>{message}</p>}

        {requests.length === 0 ? (
          <div className="Auth-message">
            <p>{copy.noPendingRequests}</p>
          </div>
        ) : (
          <div className="Requests-list">
            {requests.map((request) => (
              <div key={request.id} className="Request-card">
                <div className="Request-header">
                  <h3>{copy.deliveryRequest}</h3>
                  <span 
                    className="Request-status"
                    style={{ backgroundColor: getStatusColor(request.status) }}
                  >
                    {getStatusLabel(request.status)}
                  </span>
                </div>
                
                <p className="Request-customer">
                  <strong>{copy.fromLabel}:</strong> 
                  <span className="Request-customer-info">
                    <img 
                      src={customerAvatars[request.customer_id] || '/assets/user.svg'}
                      alt={request.customer_profile.full_name}
                      className="Delivery-avatar-small"
                      onError={(e) => {
                        e.target.src = '/assets/user.svg';
                      }}
                    />
                    {request.customer_profile.full_name} ({request.customer_profile.email})
                  </span>
                </p>
                
                <p className="Request-date">
                  <strong>{copy.requestedDate}</strong> {new Date(request.created_at).toLocaleString(getDateLocale(language), getDateLocaleOptions(language))}
                </p>

                {request.status === 'pending' && (
                  <div className="Request-actions">
                    <button 
                      type="button"
                      className="Primary-btn"
                      onClick={() => handleRespond(request.id, 'accepted')}
                      disabled={responding.requestId === request.id || cancelling === request.id}
                    >
                      {responding.requestId === request.id && responding.status === 'accepted' ? copy.accepting : copy.acceptRequest}
                    </button>
                    <button 
                      type="button"
                      className="Secondary-link"
                      onClick={() => handleRespond(request.id, 'rejected')}
                      disabled={responding.requestId === request.id || cancelling === request.id}
                    >
                      {responding.requestId === request.id && responding.status === 'rejected' ? copy.rejecting : copy.rejectRequest}
                    </button>
                  </div>
                )}
                {request.status === 'accepted' && (
                  <div className="Request-actions">
                    <button 
                      type="button"
                      className="Secondary-link"
                      onClick={() => handleCancelRequest(request.id)}
                      disabled={responding === request.id || cancelling === request.id}
                      style={{ color: 'var(--error-color)' }}
                    >
                      {cancelling === request.id ? copy.removingRequest : copy.removeRequest}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/driver-dashboard', language)}>
            {copy.driverDashboardTitle}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/available-orders', language)}>
            {copy.availableOrders}
          </a>
        </div>
      </section>
    </PageShell>
  );
}