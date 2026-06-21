import { useState, useEffect, useRef } from 'react';
import PageShell from '../components/PageShell';
import { getLocalizedPath, translations } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { useAuthSession } from '../lib/useAuthSession';
import { getProfileWithFallback, getProfileAvatarUrl } from '../lib/profile';
import { 
  createOrder, 
  createOrderItem, 
  getCustomerDeliveryLinks,
  getAcceptedDeliveryRequests
} from '../lib/database';
import { parseOrderWithAI } from '../lib/ai';

export default function CreateOrderPage({ language }) {
  const copy = translations[language];
  const { session, loading: authLoading } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [orderData, setOrderData] = useState({
    title: '',
    description: '',
    delivery_address: language === 'ar' ? 'المنزل' : 'Home',
    delivery_id: '',
  });
  
  const [orderItems, setOrderItems] = useState([
    { name: '', quantity: 1, min_price: '', max_price: '', recommended_place: '', note: '' }
  ]);
  
  const [deliveryLinks, setDeliveryLinks] = useState([]);
  const [deliveryAvatar, setDeliveryAvatar] = useState('/assets/user.svg');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState({0: true});
  
  // AI Order Assistant state
  const [aiText, setAiText] = useState('');
  const [aiOrder, setAiOrder] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [editingAIItems, setEditingAIItems] = useState(false);
  const aiTextAreaRef = useRef(null);
  const recognitionRef = useRef(null);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

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
        
        // Combine and deduplicate by delivery_id (only accepted ones for order creation)
        const combinedMap = new Map();
        
        links.forEach(link => {
          combinedMap.set(link.delivery_id, {
            delivery_id: link.delivery_id,
            delivery_profile: link.delivery_profile
          });
        });
        
        acceptedRequests.forEach(req => {
          if (!combinedMap.has(req.delivery_id)) {
            combinedMap.set(req.delivery_id, {
              delivery_id: req.delivery_id,
              delivery_profile: req.delivery_profile
            });
          }
        });
        
        const uniqueDeliveryLinks = Array.from(combinedMap.values());
        setDeliveryLinks(uniqueDeliveryLinks);
        
        // Auto-select delivery driver if there's only one
        if (uniqueDeliveryLinks.length === 1) {
          const deliveryId = uniqueDeliveryLinks[0].delivery_id || uniqueDeliveryLinks[0].delivery_profile?.id;
          setOrderData(prev => ({ ...prev, delivery_id: deliveryId }));
        }
        
        // Check for copied order data
        const copiedOrderData = localStorage.getItem('copiedOrder');
        if (copiedOrderData) {
          const parsedData = JSON.parse(copiedOrderData);
          setOrderData({
            title: parsedData.title,
            description: parsedData.description,
            delivery_address: parsedData.delivery_address,
            delivery_id: parsedData.delivery_id,
          });
          setOrderItems(parsedData.items || []);
          localStorage.removeItem('copiedOrder'); // Clear after use
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading user data:', error);
        setLoading(false);
      }
    }

    loadUserData();
  }, [session]);

  // Update delivery address default when language changes
  useEffect(() => {
    setOrderData(prev => ({
      ...prev,
      delivery_address: language === 'ar' ? 'المنزل' : 'Home'
    }));
  }, [language]);

  // Load delivery avatar when delivery_id changes
  useEffect(() => {
    async function loadDeliveryAvatar() {
      if (orderData.delivery_id) {
        try {
          const avatarUrl = await getProfileAvatarUrl(orderData.delivery_id);
          setDeliveryAvatar(avatarUrl);
        } catch (error) {
          console.error('Error loading delivery avatar:', error);
          setDeliveryAvatar('/assets/user.svg');
        }
      }
    }

    loadDeliveryAvatar();
  }, [orderData.delivery_id]);

  // Auto-expand AI textarea
  useEffect(() => {
    if (aiTextAreaRef.current) {
      aiTextAreaRef.current.style.height = 'auto';
      const newHeight = Math.max(aiTextAreaRef.current.scrollHeight, 150);
      aiTextAreaRef.current.style.height = newHeight + 'px';
    }
  }, [aiText]);

  // Initialize voice recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      
      // Use Saudi Arabic as it's most commonly supported for Arabic speech recognition
      recognition.lang = language === 'ar' ? 'ar-SA' : 'en-US';
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAiText(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
      setVoiceSupported(true);
    } else {
      setVoiceSupported(false);
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language]);

  function startVoiceInput() {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.lang = language === 'ar' ? 'ar-SA' : 'en-US';
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Error starting speech recognition:', error);
      }
    }
  }

  function stopVoiceInput() {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!orderData.delivery_id) {
      setError(copy.errorPleaseSelectDeliveryDriver);
      return;
    }

    // Validate all items - each item must have a name and quantity
    for (const item of orderItems) {
      if (!item.name || item.name.trim() === '') {
        setError(copy.allItemsMustHaveName);
        return;
      }
      if (!item.quantity || item.quantity < 0.25) {
        setError(copy.allItemsMustHaveValidQuantity);
        return;
      }
    }

    // Filter out empty items before submitting
    const validItems = orderItems.filter(item => item.name && item.name.trim() !== '');
    if (validItems.length === 0) {
      setError(copy.errorPleaseAddAtLeastOneItem);
      return;
    }

    setSubmitting(true);

    try {
      // Create order
      const order = await createOrder({
        customer_id: session.user.id,
        delivery_id: orderData.delivery_id,
        title: orderData.title,
        description: orderData.description,
        delivery_address: orderData.delivery_address,
      });

      // Create order items
      for (const item of orderItems) {
        if (item.name) {
          await createOrderItem(order.id, {
            name: item.name,
            quantity: item.quantity,
            min_price: item.min_price || null,
            max_price: item.max_price || null,
            recommended_place: item.recommended_place || null,
            note: item.note || null,
          });
        }
      }

      setMessage(copy.successOrderCreated);

      // Keep submitting true during redirect to prevent duplicate submissions
      // Redirect to order detail page after 3 seconds to ensure order is saved
      setTimeout(() => {
        window.location.href = getLocalizedPath('/order-detail', language) + `&order=${order.id}`;
      }, 3000);

    } catch (error) {
      setError(copy.errorFailedToCreateOrder + ': ' + error.message);
      setSubmitting(false);
    }
  }

  function addItem() {
    setOrderItems([...orderItems, { name: '', quantity: 1, min_price: '', max_price: '', recommended_place: '', note: '' }]);
    // Auto-collapse all items when adding new one
    setExpandedItems({});
  }

  function removeItem(index) {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  }

  function updateItem(index, field, value) {
    const updatedItems = [...orderItems];
    updatedItems[index][field] = value;
    setOrderItems(updatedItems);
  }

  function toggleItemExpand(index) {
    setExpandedItems(prev => ({ ...prev, [index]: !prev[index] }));
  }

  async function handleAIParse() {
    if (!aiText.trim()) {
      setAiError(copy.aiEnterText);
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiOrder(null);

    try {
      const result = await parseOrderWithAI(aiText, session.user, language);
      setAiOrder(result);
    } catch (error) {
      let errorMessage;
      
      // Map error codes to translated messages
      switch (error.message) {
        case 'AI_SERVICE_ERROR_500':
          errorMessage = copy.aiErrorService500;
          break;
        case 'AI_SERVICE_NOT_FOUND':
          errorMessage = copy.aiErrorServiceNotFound;
          break;
        case 'AI_SERVICE_BAD_REQUEST':
          errorMessage = copy.aiErrorBadRequest;
          break;
        case 'AI_SERVICE_RATE_LIMIT':
          errorMessage = copy.aiErrorRateLimit;
          break;
        case 'AI_SERVICE_UNAUTHORIZED':
          errorMessage = copy.aiErrorUnauthorized || 'Unauthorized access to AI service';
          break;
        case 'AI_NETWORK_ERROR':
          errorMessage = copy.aiErrorNetwork;
          break;
        case 'AI_INVALID_RESPONSE':
          errorMessage = copy.aiErrorInvalidResponse;
          break;
        case 'AI_SERVICE_ERROR_400':
          errorMessage = copy.aiErrorBadRequest;
          break;
        case 'AI_SERVICE_ERROR_429':
          errorMessage = copy.aiErrorRateLimit;
          break;
        case 'AI_SERVICE_ERROR_404':
          errorMessage = copy.aiErrorServiceNotFound;
          break;
        default:
          if (error.message.startsWith('AI_SERVICE_RATE_LIMIT|')) {
            const retryAfter = error.message.split('|')[1];
            errorMessage = language === 'ar' 
              ? `طلبات كثيرة جداً. يرجى الانتظار ${retryAfter} ثانية قبل المحاولة مرة أخرى.`
              : `Too many requests. Please wait ${retryAfter} seconds before trying again.`;
          } else if (error.message.startsWith('AI_SERVICE_ERROR_')) {
            const errorCode = error.message.replace('AI_SERVICE_ERROR_', '');
            errorMessage = copy.aiErrorGeneric || 'AI service error';
          } else {
            errorMessage = copy.aiErrorGeneric || 'Failed to parse order with AI: ' + error.message;
          }
      }
      
      setAiError(errorMessage);
    } finally {
      setAiLoading(false);
    }
  }

  function handleUseAIOrder() {
    if (!aiOrder) return;

    // AI only helps with items, not order information
    // Populate order items from AI result only
    if (aiOrder.items && aiOrder.items.length > 0) {
      const items = aiOrder.items.map(item => ({
        name: item.name || '',
        quantity: item.quantity || 1,
        min_price: '',
        max_price: '',
        recommended_place: item.recommended_place || '',
        note: item.note || ''
      }));
      setOrderItems(items);
      // Collapse all items after populating
      setExpandedItems({});
    }

    // Set the AI-generated title
    if (aiOrder.title) {
      setOrderData(prev => ({ ...prev, title: aiOrder.title }));
    }

    // Clear AI state after using
    setAiOrder(null);
    setAiText('');
  }

  function handleAIItemChange(index, field, value) {
    if (!aiOrder || !aiOrder.items) return;
    
    const updatedItems = [...aiOrder.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setAiOrder({ ...aiOrder, items: updatedItems });
  }

  function handleAddAIItem() {
    if (!aiOrder) return;
    
    const newItem = {
      name: '',
      quantity: 1,
      note: null,
      recommended_place: null
    };
    
    setAiOrder({ ...aiOrder, items: [...(aiOrder.items || []), newItem] });
  }

  function handleRemoveAIItem(index) {
    if (!aiOrder || !aiOrder.items) return;
    
    const updatedItems = aiOrder.items.filter((_, i) => i !== index);
    setAiOrder({ ...aiOrder, items: updatedItems });
  }

  // Translate field names to display in user's language
  function translateFieldName(fieldName) {
    if (language === 'ar') {
      const translations = {
        'name': 'الاسم',
        'quantity': 'الكمية',
        'note': 'ملاحظة',
        'recommended_place': 'المكان الموصى به',
        'title': 'العنوان',
        'description': 'الوصف',
        'delivery_address': 'عنوان التوصيل',
        'delivery_id': 'معرف التوصيل',
        'الاسم': 'الاسم',
        'الكمية': 'الكمية',
        'ملاحظة': 'ملاحظة',
        'المكان الموصى به': 'المكان الموصى به'
      };
      return translations[fieldName] || fieldName;
    }
    return fieldName;
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

        <h1>{copy.createOrderTitle}</h1>
        {deliveryLinks.length > 0 && (
          <p className="Auth-message">{copy.createOrderMessage}</p>
        )}

        {deliveryLinks.length === 0 ? (
          <div className="Auth-message">
            <p>{copy.noDeliveryLinked}</p>
            <a className="Primary-btn" href={getLocalizedPath('/delivery-network', language)}>
              {copy.addDeliveryFirst}
            </a>
          </div>
        ) : (
          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
            {/* AI Order Assistant Section */}
            <div style={{ marginBottom: '24px', padding: '20px', border: '2px dashed var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--card-bg)' }}>
              <h3 style={{ marginBottom: '12px', color: 'var(--text-primary)' }}>🤖 {copy.aiTitle || 'AI Order Assistant'}</h3>
              <p style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {copy.aiDescription || 'Type your order in plain text (English, Arabic, or Libyan Arabic) and let AI help you create items.'}
              </p>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ position: 'relative' }}>
                  <textarea
                    ref={aiTextAreaRef}
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder={copy.aiPlaceholder || 'e.g., "I want 2 shawarma and a pepsi"'}
                    disabled={aiLoading || isListening}
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '12px',
                      paddingRight: voiceSupported && language !== 'ar' ? '50px' : '12px',
                      paddingLeft: voiceSupported && language === 'ar' ? '50px' : '12px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      resize: 'none',
                      minHeight: '150px',
                      fontFamily: 'inherit',
                      overflow: 'hidden',
                      direction: language === 'ar' ? 'rtl' : 'ltr'
                    }}
                  />
                  {voiceSupported && (
                    <button
                      type="button"
                      onClick={isListening ? stopVoiceInput : startVoiceInput}
                      disabled={aiLoading}
                      style={{
                        position: 'absolute',
                        right: language === 'ar' ? 'auto' : '12px',
                        left: language === 'ar' ? '12px' : 'auto',
                        top: '12px',
                        background: isListening ? 'var(--error-color)' : 'var(--accent-color)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '36px',
                        height: '36px',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        opacity: aiLoading ? 0.5 : 1
                      }}
                      title={isListening ? (copy.voiceInputListening || 'Listening...') : (copy.voiceInput || 'Voice Input')}
                    >
                      {isListening ? '⏹' : '🎤'}
                    </button>
                  )}
                </div>
                {isListening && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: 'var(--status-accepted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    direction: language === 'ar' ? 'rtl' : 'ltr'
                  }}>
                    <span style={{ color: 'var(--error-color)', fontWeight: 'bold' }}>●</span>
                    {copy.voiceInputListening || 'Listening...'}
                  </div>
                )}
                {!voiceSupported && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    color: 'var(--error-color)',
                    direction: language === 'ar' ? 'rtl' : 'ltr'
                  }}>
                    {copy.voiceInputNotSupported || 'Voice input not supported'}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleAIParse}
                disabled={aiLoading || !aiText.trim()}
                className="Primary-btn"
                style={{
                  marginTop: '12px',
                  width: '100%',
                  padding: '12px 24px',
                  fontSize: '0.95rem',
                  opacity: (aiLoading || !aiText.trim()) ? 0.5 : 1,
                  cursor: (aiLoading || !aiText.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {aiLoading ? (copy.aiProcessing || 'Processing...') : (copy.aiAssist || 'AI Assist')}
              </button>
              {aiError && (
                <p style={{ color: 'var(--error-color)', fontSize: '0.85rem', marginTop: '8px' }}>{aiError}</p>
              )}

              {/* AI Order Preview - Now inside the AI box */}
              {aiOrder && (
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-primary)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{copy.aiPreviewTitle || '📋 AI Order Preview'}</h4>
                    <button
                      type="button"
                      onClick={() => setEditingAIItems(!editingAIItems)}
                      style={{
                        background: 'none',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--accent-color)',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                      }}
                    >
                      {editingAIItems ? (copy.doneEditing || 'Done Editing') : (copy.editItems || 'Edit Items')}
                    </button>
                  </div>

                  {/* Items List */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {copy.itemsLabel || 'Items'} ({aiOrder.items?.length || 0})
                    </div>
                    {aiOrder.items && aiOrder.items.length > 0 ? (
                      <div style={{ display: 'grid', gap: '12px', maxWidth: '100%', overflowX: 'auto' }}>
                        {aiOrder.items.map((item, index) => (
                          <div key={index} style={{
                            padding: '12px',
                            backgroundColor: 'var(--input-bg)',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            minWidth: '0',
                            wordBreak: 'break-word'
                          }}>
                            {editingAIItems ? (
                              <div style={{ display: 'grid', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  <input
                                    type="text"
                                    value={item.name || ''}
                                    onChange={(e) => handleAIItemChange(index, 'name', e.target.value)}
                                    placeholder={copy.itemNamePlaceholder || 'Item name'}
                                    style={{
                                      flex: 1,
                                      minWidth: '120px',
                                      padding: '6px',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      backgroundColor: 'var(--card-bg)',
                                      color: 'var(--text-primary)'
                                    }}
                                  />
                                  <input
                                    type="number"
                                    value={item.quantity || 1}
                                    onChange={(e) => handleAIItemChange(index, 'quantity', parseFloat(e.target.value) || 1)}
                                    placeholder={copy.quantityLabel || 'Qty'}
                                    min="0.25"
                                    step="0.05"
                                    style={{
                                      width: '60px',
                                      padding: '6px',
                                      border: '1px solid var(--border-color)',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                      backgroundColor: 'var(--card-bg)',
                                      color: 'var(--text-primary)'
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAIItem(index)}
                                    style={{
                                      background: 'var(--status-cancelled)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontSize: '0.85rem',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {copy.aiRemoveItem || copy.remove || 'Remove'}
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  value={item.note || ''}
                                  onChange={(e) => handleAIItemChange(index, 'note', e.target.value)}
                                  placeholder={copy.noteOptional || 'Note (optional)'}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    backgroundColor: 'var(--card-bg)',
                                    color: 'var(--text-primary)'
                                  }}
                                />
                                <input
                                  type="text"
                                  value={item.recommended_place || ''}
                                  onChange={(e) => handleAIItemChange(index, 'recommended_place', e.target.value)}
                                  placeholder={copy.recommendedPlaceOptional || 'Recommended place (optional)'}
                                  style={{
                                    width: '100%',
                                    padding: '6px',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    backgroundColor: 'var(--card-bg)',
                                    color: 'var(--text-primary)'
                                  }}
                                />
                              </div>
                            ) : (
                              <>
                                <div style={{ fontWeight: '600', marginBottom: '4px', color: 'var(--text-primary)' }}>{item.name}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  {copy.quantityLabel || 'Quantity'}: {item.quantity} {item.note && `• ${copy.noteLabel || 'Note'}: ${item.note}`} {item.recommended_place && `• ${copy.recommendedPlaceLabel || 'Place'}: ${item.recommended_place}`}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {editingAIItems && (
                          <button
                            type="button"
                            onClick={handleAddAIItem}
                            style={{
                              width: '100%',
                              padding: '8px',
                              background: 'var(--accent-color)',
                              color: 'var(--button-text)',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                          >
                            {copy.addItem || '+ Add Item'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>{copy.noItemsParsed || 'No items parsed'}</p>
                    )}
                  </div>

                  {/* Missing Fields Warning */}
                  {aiOrder.missing_fields && aiOrder.missing_fields.length > 0 && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      <h4 style={{ marginBottom: '8px', color: 'var(--error-color)', margin: 0 }}>{copy.missingInfo || '⚠️ Missing Information'}</h4>
                      <ul style={{ margin: 0, paddingLeft: language === 'ar' ? '0' : '20px', paddingRight: language === 'ar' ? '20px' : '0', fontSize: '0.9rem', color: 'var(--error-color)', direction: language === 'ar' ? 'rtl' : 'ltr' }}>
                        {aiOrder.missing_fields.map((field, index) => (
                          <li key={index} style={language === 'ar' ? { marginRight: '20px' } : {}}>{translateFieldName(field)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Questions from AI */}
                  {aiOrder.questions && aiOrder.questions.length > 0 && (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                      <h4 style={{ marginBottom: '8px', color: 'var(--warning-color)', margin: 0 }}>{copy.questions || '❓ Questions'}</h4>
                      <ul style={{ margin: 0, paddingLeft: language === 'ar' ? '0' : '20px', paddingRight: language === 'ar' ? '20px' : '0', fontSize: '0.9rem', color: 'var(--warning-color)', direction: language === 'ar' ? 'rtl' : 'ltr' }}>
                        {aiOrder.questions.map((question, index) => (
                          <li key={index} style={language === 'ar' ? { marginRight: '20px' } : {}}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Use This Order Button */}
                  <button
                    type="button"
                    onClick={handleUseAIOrder}
                    className="Primary-btn"
                    disabled={!aiOrder?.items || aiOrder.items.length === 0 || aiOrder.items.some(item => !item.name || item.name.trim() === '')}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      opacity: (!aiOrder?.items || aiOrder.items.length === 0 || aiOrder.items.some(item => !item.name || item.name.trim() === '')) ? 0.5 : 1,
                      cursor: (!aiOrder?.items || aiOrder.items.length === 0 || aiOrder.items.some(item => !item.name || item.name.trim() === '')) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {copy.useThisOrder || 'Use This Order'}
                  </button>
                </div>
              )}
            </div>

            <form className="Auth-form" onSubmit={handleSubmit} style={{ maxWidth: '100%', margin: '0 auto', padding: '24px' }}>
              <label className="Auth-field">
                <span>{copy.orderTitleLabel}</span>
                <input
                  type="text"
                  required
                  value={orderData.title}
                  onChange={(e) => setOrderData({...orderData, title: e.target.value})}
                  placeholder={copy.orderTitlePlaceholder}
                />
              </label>

              <label className="Auth-field">
                <span>{copy.descriptionLabel}</span>
                <textarea
                  value={orderData.description}
                  onChange={(e) => setOrderData({...orderData, description: e.target.value})}
                  placeholder={copy.descriptionPlaceholder}
                  rows={3}
                />
              </label>

              <label className="Auth-field">
                <span>{copy.deliveryAddressLabel}</span>
                <input
                  type="text"
                  value={orderData.delivery_address}
                  onChange={(e) => setOrderData({...orderData, delivery_address: e.target.value})}
                  placeholder={copy.deliveryAddressPlaceholder}
                />
              </label>

              <label className="Auth-field">
                <span>{copy.selectDeliveryLabel}</span>
                <select
                  required
                  value={orderData.delivery_id}
                  onChange={(e) => setOrderData({...orderData, delivery_id: e.target.value})}
                >
                  <option value="">{copy.selectDeliveryLabel}</option>
                  {deliveryLinks.map((link) => {
                    const deliveryId = link.delivery_id || link.delivery_profile?.id;
                    const fullName = link.delivery_profile?.full_name || 'Unknown';
                    const email = link.delivery_profile?.email || '';
                    return (
                      <option key={deliveryId} value={deliveryId}>
                        {fullName} ({email})
                      </option>
                    );
                  })}
                </select>
                {deliveryLinks.length === 0 && (
                  <p style={{ color: 'var(--error-color)', fontSize: '0.85rem', marginTop: '8px' }}>
                    {copy.noDeliveryLinked} <a href={getLocalizedPath('/delivery-network', language)} style={{ color: 'var(--accent-color)' }}>{copy.addDeliveryFirst}</a>
                  </p>
                )}
                {orderData.delivery_id && deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', padding: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                    <img
                      src={deliveryAvatar}
                      alt="Delivery Driver Avatar"
                      className="Delivery-avatar-small"
                      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
                      onError={(e) => {
                        e.target.src = '/assets/user.svg';
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id)?.delivery_profile?.full_name || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {deliveryLinks.find(link => (link.delivery_id || link.delivery_profile?.id) === orderData.delivery_id)?.delivery_profile?.email || ''}
                      </div>
                    </div>
                  </div>
                )}
              </label>

              <div className="Order-items-container">
                <h3>{copy.itemsInOrder}</h3>
                
                {orderItems.map((item, index) => (
                  <div key={index} className="Order-item-vertical" style={{ marginBottom: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <button 
                        type="button"
                        onClick={() => toggleItemExpand(index)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--text-primary)', 
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        <span>{expandedItems[index] ? '▼' : '▶'}</span>
                        <span>{item.name || copy.itemNameLabel}</span>
                      </button>
                      {orderItems.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeItem(index)}
                          disabled={submitting}
                          style={{ 
                            background: 'var(--status-cancelled)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            padding: '4px 8px', 
                            fontSize: '0.8rem', 
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            opacity: submitting ? 0.5 : 1
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    
                    {expandedItems[index] ? (
                      <>
                      <div className="Order-item-row">
                        <label className="Order-item-vertical-label">{copy.itemNameLabel}</label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateItem(index, 'name', e.target.value)}
                          placeholder={copy.itemNamePlaceholder}
                          className="Order-item-input"
                        />
                      </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.quantityLabel}</label>
                      <input
                        type="number"
                        required
                        min="0.25"
                        step="0.05"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.minPriceLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.min_price}
                        onChange={(e) => updateItem(index, 'min_price', e.target.value)}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.maxPriceLabel}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={item.max_price}
                        onChange={(e) => updateItem(index, 'max_price', e.target.value)}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.recommendedPlaceLabel}</label>
                      <input
                        type="text"
                        value={item.recommended_place}
                        onChange={(e) => updateItem(index, 'recommended_place', e.target.value)}
                        placeholder={copy.recommendedPlaceOptional}
                        className="Order-item-input"
                      />
                    </div>
                    <div className="Order-item-row">
                      <label className="Order-item-vertical-label">{copy.noteLabel}</label>
                      <input
                        type="text"
                        value={item.note}
                        onChange={(e) => updateItem(index, 'note', e.target.value)}
                        placeholder={copy.noteOptional}
                        className="Order-item-input"
                      />
                    </div>
                    </>
                  ) : (
                  <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {item.name ? `${item.name} (Qty: ${item.quantity})` : copy.clickToEdit}
                  </div>
                )}
                  </div>
                ))}
                
                <button 
                  type="button" 
                  className="Primary-btn" 
                  onClick={addItem}
                  disabled={submitting}
                  style={{ 
                    marginTop: '16px', 
                    padding: '8px 16px', 
                    fontSize: '0.85rem',
                    width: '100%'
                  }}
                >
                  + {copy.addItem}
                </button>
              </div>

            {error && <p className="Auth-error" role="alert">{error}</p>}
            {message && <p className="Auth-message" style={{ color: 'green' }}>{message}</p>}

            <div className="Action-row">
              <button
                type="submit"
                className="Primary-btn"
                disabled={submitting}
              >
                {submitting ? copy.creatingOrder : copy.createOrder}
              </button>
              <button
                type="button"
                onClick={() => window.location.href = getLocalizedPath('/', language)}
                disabled={submitting}
                style={{
                  marginLeft: '16px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  border: '2px solid var(--border-color)',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  borderRadius: '50px',
                  opacity: submitting ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (!submitting) {
                    e.target.style.backgroundColor = 'var(--border-color)';
                    e.target.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!submitting) {
                    e.target.style.backgroundColor = 'transparent';
                    e.target.style.color = 'var(--text-primary)';
                  }
                }}
              >
                {copy.cancel}
              </button>
            </div>
          </form>
          </div>
        )}
      </section>
    </PageShell>
  );
}
