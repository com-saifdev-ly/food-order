import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';
import { 
  searchDeliveryUsers, 
  createDeliveryRequest,
  deleteCustomerDeliveryLink,
  cancelDeliveryRequest,
  getCustomerDeliveryLinks,
  getCustomerDeliveryRequests,
  getAcceptedDeliveryRequests
} from '../lib/database';
import { showConfirmDialog } from '../components/ConfirmDialog';

export default function DeliveryNetworkPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [linkedDelivery, setLinkedDelivery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState('');
  const [deliveryAvatars, setDeliveryAvatars] = useState({});
  const [searchResultAvatars, setSearchResultAvatars] = useState({});
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    async function loadUserData() {
      if (!session) return;

      try {
        // Get user profile from database with fallback to metadata
        const profile = await getProfileWithFallback(session.user.id, session.user.email);
        setProfile(profile);

        // Get linked delivery users (direct links + accepted requests)
        const links = await getCustomerDeliveryLinks(session.user.id);
        const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
        const allRequests = await getCustomerDeliveryRequests(session.user.id);
        
        // Combine and deduplicate by delivery_id
        const combinedMap = new Map();
        
        links.forEach(link => {
          combinedMap.set(link.delivery_id, {
            id: link.id,
            delivery_id: link.delivery_id,
            delivery_profile: link.delivery_profile,
            type: 'direct'
          });
        });
        
        acceptedRequests.forEach(req => {
          if (!combinedMap.has(req.delivery_id)) {
            combinedMap.set(req.delivery_id, {
              id: req.id,
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile,
              type: 'direct'
            });
          }
        });
        
        allRequests
          .filter(req => (req.status === 'pending' || req.status === 'rejected') && !combinedMap.has(req.delivery_id))
          .forEach(req => {
            combinedMap.set(req.delivery_id, {
              id: req.id,
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile,
              type: req.status // Use status directly: 'pending' or 'rejected'
            });
          });
        
        setLinkedDelivery(Array.from(combinedMap.values()));

        // Load delivery avatars
        const avatarMap = {};
        for (const link of Array.from(combinedMap.values())) {
          if (link.delivery_id) {
            try {
              const avatarUrl = await getProfileAvatarUrl(link.delivery_id);
              avatarMap[link.delivery_id] = avatarUrl;
            } catch (error) {
              console.error('Error loading delivery avatar:', error);
              avatarMap[link.delivery_id] = '/assets/user.svg';
            }
          }
        }
        setDeliveryAvatars(avatarMap);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
      }
    }

    loadUserData();
  }, [session]);

  async function handleSearch() {
    if (!searchTerm.trim()) {
      setMessage(copy.pleaseEnterSearchTerm);
      return;
    }

    setHasSearched(true);
    setSearching(true);
    try {
      const results = await searchDeliveryUsers(searchTerm);
      setSearchResults(results);

      // Load avatars for search results
      const avatarMap = {};
      for (const user of results) {
        if (user.id) {
          try {
            const avatarUrl = await getProfileAvatarUrl(user.id);
            avatarMap[user.id] = avatarUrl;
          } catch (error) {
            console.error('Error loading search result avatar:', error);
            avatarMap[user.id] = '/assets/user.svg';
          }
        }
      }
      setSearchResultAvatars(avatarMap);

      setSearching(false);
    } catch (error) {
      setMessage(copy.searchDeliveryError + ': ' + error.message);
      setSearching(false);
    }
  }

  async function handleAddDelivery(deliveryId) {
    setAdding(deliveryId);
    try {
      // Send delivery request instead of creating direct link
      await createDeliveryRequest(session.user.id, deliveryId);
      setMessage(copy.deliveryRequestSentLong);
      
      // Refresh linked delivery users to show pending requests
      const links = await getCustomerDeliveryLinks(session.user.id);
      const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
      const allRequests = await getCustomerDeliveryRequests(session.user.id);
      
      // Combine and deduplicate by delivery_id
      const combinedMap = new Map();
      
      links.forEach(link => {
        combinedMap.set(link.delivery_id, {
          id: link.id,
          delivery_id: link.delivery_id,
          delivery_profile: link.delivery_profile,
          type: 'direct'
        });
      });
      
      acceptedRequests.forEach(req => {
        if (!combinedMap.has(req.delivery_id)) {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: 'direct'
          });
        }
      });
      
      allRequests
        .filter(req => (req.status === 'pending' || req.status === 'rejected') && !combinedMap.has(req.delivery_id))
        .forEach(req => {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: req.status // Use status directly: 'pending' or 'rejected'
          });
        });
      
      setLinkedDelivery(Array.from(combinedMap.values()));
      
      // Remove from search results
      setSearchResults(searchResults.filter(r => r.id !== deliveryId));
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.sendRequestFailed + ': ' + error.message);
    } finally {
      setAdding(null);
    }
  }

  async function handleRemoveDelivery(deliveryId) {
    const confirmed = await showConfirmDialog(copy.confirmRemoveDeliveryDriver, language);
    if (!confirmed) return;

    setRemoving(deliveryId);
    try {
      // Try to delete the link (works for both direct links and accepted requests)
      await deleteCustomerDeliveryLink(session.user.id, deliveryId);
      setMessage(copy.deliveryDriverRemovedSuccess);
      
      // Refresh linked delivery users
      const links = await getCustomerDeliveryLinks(session.user.id);
      const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
      const allRequests = await getCustomerDeliveryRequests(session.user.id);
      
      // Combine and deduplicate by delivery_id
      const combinedMap = new Map();
      
      links.forEach(link => {
        combinedMap.set(link.delivery_id, {
          id: link.id,
          delivery_id: link.delivery_id,
          delivery_profile: link.delivery_profile,
          type: 'direct'
        });
      });
      
      acceptedRequests.forEach(req => {
        if (!combinedMap.has(req.delivery_id)) {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: 'direct'
          });
        }
      });
      
      allRequests
        .filter(req => (req.status === 'pending' || req.status === 'rejected') && !combinedMap.has(req.delivery_id))
        .forEach(req => {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: req.status // Use status directly: 'pending' or 'rejected'
          });
        });
      
      setLinkedDelivery(Array.from(combinedMap.values()));
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.removeDeliveryDriverFailed + ': ' + error.message);
    } finally {
      setRemoving(null);
    }
  }

  async function handleCancelRequest(requestId) {
    const confirmed = await showConfirmDialog(copy.confirmCancelDeliveryRequest, language);
    if (!confirmed) return;

    setCancelling(requestId);
    try {
      await cancelDeliveryRequest(requestId);
      setMessage(copy.deliveryRequestCancelledSuccess);
      
      // Refresh linked delivery users
      const links = await getCustomerDeliveryLinks(session.user.id);
      const acceptedRequests = await getAcceptedDeliveryRequests(session.user.id);
      const allRequests = await getCustomerDeliveryRequests(session.user.id);
      
      // Combine and deduplicate by delivery_id
      const combinedMap = new Map();
      
      links.forEach(link => {
        combinedMap.set(link.delivery_id, {
          id: link.id,
          delivery_id: link.delivery_id,
          delivery_profile: link.delivery_profile,
          type: 'direct'
        });
      });
      
      acceptedRequests.forEach(req => {
        if (!combinedMap.has(req.delivery_id)) {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: 'direct'
          });
        }
      });
      
      allRequests
        .filter(req => (req.status === 'pending' || req.status === 'rejected') && !combinedMap.has(req.delivery_id))
        .forEach(req => {
          combinedMap.set(req.delivery_id, {
            id: req.id,
            delivery_id: req.delivery_id,
            delivery_profile: req.delivery_profile,
            type: req.status // Use status directly: 'pending' or 'rejected'
          });
        });
      
      setLinkedDelivery(Array.from(combinedMap.values()));
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(copy.cancelRequestFailed + ': ' + error.message);
    } finally {
      setCancelling(null);
    }
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

  if (!session || profile?.role !== 'customer') {
    window.location.href = getLocalizedPath('/', language);
    return null;
  }

  return (
    <PageShell language={language}>
      <section className="Hero-card">

        <h1>{copy.deliveryNetwork}</h1>
        <p className="Auth-message">{copy.welcome}, {profile.fullName}!</p>

        {message && <p className="Auth-message" style={{ color: message.includes('failed') ? 'red' : 'green' }}>{message}</p>}

        {/* Linked Delivery Users */}
        <div className="Linked-delivery">
          <h2>{copy.linkedDelivery}</h2>
          {linkedDelivery.length === 0 ? (
            <p>{copy.noLinkedDelivery}</p>
          ) : (
            <div className="Delivery-list">
              {linkedDelivery.map((link) => {
                const status = link.type === 'pending' ? copy.statusPending : link.type === 'rejected' ? copy.statusRejected : link.type === 'accepted' ? copy.statusAccepted : copy.linked;
                const statusColor = link.type === 'pending' ? 'var(--status-pending)' : link.type === 'rejected' ? 'var(--status-rejected)' : link.type === 'accepted' ? 'var(--status-delivered)' : 'var(--status-accepted)';
                const avatarUrl = deliveryAvatars[link.delivery_id] || '/assets/user.svg';
                return (
                  <div key={link.id} className="Delivery-item">
                    <div className="Delivery-item-avatar">
                      <img 
                        src={avatarUrl}
                        alt={link.delivery_profile?.full_name || 'Driver'}
                        className="Delivery-avatar-small"
                        onError={(e) => {
                          e.target.src = '/assets/user.svg';
                        }}
                      />
                      <div className="Delivery-info">
                        <h3>{link.delivery_profile?.full_name || 'Unknown'}</h3>
                        <p>{link.delivery_profile?.email || 'No email'}</p>
                        <span className="Delivery-status" style={{ color: statusColor }}>
                          {status}
                        </span>
                      </div>
                    </div>
                    {link.type === 'pending' && (
                      <button 
                        type="button"
                        className="Secondary-link"
                        onClick={() => handleCancelRequest(link.id)}
                        disabled={cancelling === link.id}
                      >
                        {cancelling === link.id ? copy.cancellingRequest : copy.cancelRequest}
                      </button>
                    )}
                    {(link.type === 'direct' || link.type === 'linked' || link.type === 'accepted') && (
                      <button 
                        type="button"
                        className="Secondary-link"
                        onClick={() => handleRemoveDelivery(link.delivery_id)}
                        disabled={removing === link.delivery_id}
                      >
                        {removing === link.delivery_id ? copy.removingDelivery : copy.removeDelivery}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Search Delivery Users */}
        <div className="Search-delivery">
          <h2>{copy.addDeliveryTitle}</h2>
          <div className="Search-bar">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value === '') {
                  setHasSearched(false);
                }
              }}
              placeholder={copy.searchDeliveryPlaceholder}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
              type="button"
              className="Primary-btn"
              onClick={handleSearch}
              disabled={searching}
            >
              {searching ? copy.searching : copy.search}
            </button>
          </div>

          {searchResults.length === 0 && hasSearched && !searching && (
            <p>{copy.noResultsFound}</p>
          )}

          {searchResults.length > 0 && (
            <div className="Delivery-list">
              {searchResults.map((delivery) => {
                const isAlreadyLinked = linkedDelivery.some(link => link.delivery_id === delivery.id);
                const status = linkedDelivery.find(link => link.delivery_id === delivery.id)?.type || null;
                const avatarUrl = searchResultAvatars[delivery.id] || '/assets/user.svg';
                
                return (
                  <div key={delivery.id} className="Delivery-item">
                    <div className="Delivery-item-avatar">
                      <img 
                        src={avatarUrl}
                        alt={delivery.full_name}
                        className="Delivery-avatar-small"
                        onError={(e) => {
                          e.target.src = '/assets/user.svg';
                        }}
                      />
                      <div className="Delivery-info">
                        <h3>{delivery.full_name}</h3>
                        <p>{delivery.email}</p>
                      </div>
                    </div>
                    {status === 'pending' ? (
                      <span className="Delivery-status" style={{ color: 'var(--status-pending)' }}>
                        {copy.statusPending}
                      </span>
                    ) : status === 'rejected' ? (
                      <span className="Delivery-status" style={{ color: 'var(--status-rejected)' }}>
                        {copy.statusRejected}
                      </span>
                    ) : status === 'direct' || status === 'linked' ? (
                      <span className="Delivery-status" style={{ color: 'var(--status-delivered)' }}>
                        {copy.linked}
                      </span>
                    ) : (
                      <button 
                        type="button"
                        className="Primary-btn"
                        onClick={() => handleAddDelivery(delivery.id)}
                        disabled={adding === delivery.id}
                      >
                        {adding === delivery.id ? copy.addingDelivery : copy.addDelivery}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="Action-row">
          <a className="Primary-btn" href={getLocalizedPath('/create-order', language)}>
            {copy.createOrder}
          </a>
          <a className="Secondary-link" href={getLocalizedPath('/customer-dashboard', language)}>
            {copy.back}
          </a>
        </div>
      </section>
    </PageShell>
  );
}
