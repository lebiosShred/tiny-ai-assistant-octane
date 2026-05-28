import React, { useState, useEffect } from 'react';
import {
  hubspot,
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Divider,
  Alert,
  LoadingSpinner,
  Checkbox
} from '@hubspot/ui-extensions';
import { useCrmProperties } from '@hubspot/ui-extensions/crm';

const DEFAULT_QUESTIONS = {
  "Variant A": [
    "What general ledger/ERP system (e.g. SAP, NetSuite) are you using?",
    "How many separate Excel spreadsheets are you manually consolidating?",
    "What specific planning workflows (e.g. actuals, payroll) are you executing?",
    "What reporting tools (e.g. Power BI, Tableau) do you use?",
    "Do users need to drill down to transaction-level GL data?",
    "Do you have internal developers/admins to manage these systems?",
    "How many planning contributors and admins are involved?",
    "What repetitive financial tasks feel most manual?",
    "What is your target timeline for going live?",
    "Is there a budget allocated for licensing and delivery?",
    "Have you evaluated other tools (e.g. Workday, Anaplan)?",
    "Would a 60-day trial of connectors help validate the solution?"
  ],
  "Variant B": [
    "Why did you contact us? What do you hope to achieve?",
    "How long have you been users of TM1?",
    "What do you primarily use TM1 to do?",
    "Where does it fall short or create friction?",
    "Which parts of finance are actively using it today?",
    "Is usage across the business or limited to finance?",
    "Have users mostly adopted TM1 or do they resort to using Excel?",
    "Do users find it difficult to make enhancements? Who makes the enhancements?",
    "Are you aware of performance, speed, or usability challenges?",
    "Is the instance cloud or on-premise?"
  ],
  "Variant C": [
    "How much time does the finance team spend on monthly reporting?",
    "What data sources (TM1, Adobe, BigQuery) need to connect?",
    "Would executives benefit from natural language queries (AskFinance)?",
    "What other business areas (Sales, HR) have repetitive workflows?",
    "Have you deployed any generative AI or automation tools?",
    "What is your primary cloud environment and data security policy?",
    "Do you require specific role-based access controls for AI?",
    "Would you be open to a 2-to-6 week co-creation Proof of Concept?",
    "Can you commit a primary business and technical resource for the POC?",
    "Are you willing to commit to a Decision Workshop within 10 days?",
    "Are you aware of the indicative costs ($160k+/yr SaaS, $125k+ service)?",
    "What is your timeline for starting an AI pilot?"
  ]
};

const Extension = ({ context }) => {
  const { objectId } = context;
  
  // 1. Fetch CRM Properties (booking intake)
  const { properties, fetchStatus, error } = useCrmProperties(["firstname", "lastname", "hubspot_booking_intake"]);
  
  const [variant, setVariant] = useState("Variant A");
  const [variantName, setVariantName] = useState("First-Time TM1 (GL & ERP Integrations)");
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS["Variant A"]);
  const [checkedStates, setCheckedStates] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [connected, setConnected] = useState(null);

  // 2. Classify track interest based on booking intake response
  useEffect(() => {
    if (properties && properties.hubspot_booking_intake) {
      const intake = properties.hubspot_booking_intake.toLowerCase();
      if (intake.includes('agentic') || intake.includes('watsonx') || intake.includes('artificial intelligence') || intake.includes('generative ai') || intake.includes('ai')) {
        setVariant("Variant C");
        setVariantName("Agentic AI Operations (Watsonx & Custom Agents)");
        setQuestions(DEFAULT_QUESTIONS["Variant C"]);
      } else if (intake.includes('support') || intake.includes('planning analytics') || intake.includes('tm1') || intake.includes('cognos')) {
        setVariant("Variant B");
        setVariantName("Existing TM1 (Support & Performance Optimization)");
        setQuestions(DEFAULT_QUESTIONS["Variant B"]);
      } else {
        setVariant("Variant A");
        setVariantName("First-Time TM1 (GL & ERP Integrations)");
        setQuestions(DEFAULT_QUESTIONS["Variant A"]);
      }
    }
  }, [properties]);

  // 3. Check connection to the Cloud Run proxy server
  useEffect(() => {
    hubspot.fetch("https://tiny-ai-assistant-351972137415.us-central1.run.app")
      .then(res => {
        if (res.status === 200) {
          setConnected(true);
        } else {
          setConnected(false);
        }
      })
      .catch(() => {
        setConnected(false);
      });
  }, []);

  // 4. Calculate progress percentage
  const totalQuestions = questions.length;
  const completedQuestions = Object.values(checkedStates).filter(Boolean).length;
  const progressPercent = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0;

  // Toggle handler for checkboxes
  const handleToggle = (index, isChecked) => {
    setCheckedStates(prev => ({
      ...prev,
      [index]: isChecked
    }));
  };

  // Trigger prep briefing generation
  const handleTriggerPrep = () => {
    setLoading(true);
    setActionResult(null);
    setActionError(null);
    
    hubspot.fetch("https://tiny-ai-assistant-351972137415.us-central1.run.app/api/hubspot/prep", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ contactId: objectId })
    })
    .then(async (res) => {
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.status === 'success') {
        setActionResult({ type: 'prep', briefing: data.briefing });
      } else {
        setActionError(data.error || 'Failed to generate pre-screen briefing.');
      }
    })
    .catch((err) => {
      setLoading(false);
      setActionError(err.message || 'Network error connecting to proxy.');
    });
  };

  // Trigger call synthesis
  const handleTriggerSynthesize = () => {
    setLoading(true);
    setActionResult(null);
    setActionError(null);

    // Resolve latest call ID first, then run synthesis
    hubspot.fetch("https://tiny-ai-assistant-351972137415.us-central1.run.app/api/hubspot/latest-call?contactId=" + objectId)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.callId) {
          return hubspot.fetch("https://tiny-ai-assistant-351972137415.us-central1.run.app/api/hubspot/synthesize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ callId: data.callId })
          });
        } else {
          throw new Error(data.error || 'No associated calls found for this contact to synthesize.');
        }
      })
      .then(async (res) => {
        const data = await res.json();
        setLoading(false);
        if (res.ok && data.status === 'success') {
          setActionResult({ type: 'synthesis', briefing: data.briefing });
        } else {
          setActionError(data.error || 'Failed to synthesize call report.');
        }
      })
      .catch((err) => {
        setLoading(false);
        setActionError(err.message || 'Error occurred during call synthesis.');
      });
  };

  if (fetchStatus === 'fetching') {
    return (
      <Flex direction="column" align="center" padding="medium" gap="small">
        <LoadingSpinner />
        <Text>Fetching CRM context...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert title="CRM Context Error" variant="error">
        Failed to fetch contact details: {error.message}
      </Alert>
    );
  }

  return (
    <Flex direction="column" gap="medium">
      {/* 1. Status Indicator & Connected Badge */}
      <Flex direction="row" justify="between" align="center">
        <Text variant="micro">
          <strong>PROXY STATUS:</strong>
        </Text>
        {connected === null ? (
          <Text variant="micro">Checking...</Text>
        ) : connected ? (
          <Text variant="micro" color="green">● Connected</Text>
        ) : (
          <Text variant="micro" color="red">▲ Offline (Config Required)</Text>
        )}
      </Flex>

      <Divider />

      {/* 2. Detected Track Panel */}
      <Box padding="small" css={{ backgroundColor: '#F8F9FA', borderRadius: '4px', borderLeft: '4px solid #0070D2' }}>
        <Heading variant="h6">Detected Selling Track</Heading>
        <Text variant="small"><strong>{variant}</strong>: {variantName}</Text>
        <Text variant="micro" css={{ marginTop: '4px', fontStyle: 'italic' }}>
          Based on booking intake: "{properties?.hubspot_booking_intake || 'None'}"
        </Text>
      </Box>

      {/* 3. Interactive Checklist Progress */}
      <Flex direction="column" gap="xs">
        <Flex direction="row" justify="between" align="center">
          <Text variant="small"><strong>Live Battlecard Checklist</strong></Text>
          <Text variant="small">{completedQuestions}/{totalQuestions} ({progressPercent}%)</Text>
        </Flex>
        {/* Custom Progress Bar */}
        <Box css={{ width: '100%', height: '8px', backgroundColor: '#E0E0E0', borderRadius: '4px', overflow: 'hidden' }}>
          <Box css={{ width: progressPercent + '%', height: '100%', backgroundColor: '#2E7D32', transition: 'width 0.3s ease' }} />
        </Box>
      </Flex>

      {/* 4. Scrollable Checklist Items */}
      <Box css={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
        <Flex direction="column" gap="small">
          {questions.map((q, idx) => (
            <Checkbox
              key={idx}
              label={q}
              checked={!!checkedStates[idx]}
              onCheckedChange={(isChecked) => handleToggle(idx, isChecked)}
            />
          ))}
        </Flex>
      </Box>

      <Divider />

      {/* 5. Trigger Buttons */}
      <Flex direction="column" gap="small">
        <Button
          onClick={handleTriggerPrep}
          variant="primary"
          isDisabled={loading}
        >
          {loading ? 'Processing...' : 'Generate Call Prep Briefing'}
        </Button>
        <Button
          onClick={handleTriggerSynthesize}
          variant="secondary"
          isDisabled={loading}
        >
          {loading ? 'Processing...' : 'Synthesize Call Report'}
        </Button>
      </Flex>

      {/* 6. Action Alerts & Previews */}
      {loading && (
        <Flex direction="column" align="center" padding="small" gap="small">
          <LoadingSpinner />
          <Text variant="small">Invoking AI engines on proxy backend...</Text>
        </Flex>
      )}

      {actionError && (
        <Alert title="Action Failed" variant="error">
          {actionError}
        </Alert>
      )}

      {actionResult && (
        <Flex direction="column" gap="small">
          <Alert title="Success" variant="success">
            {actionResult.type === 'prep'
              ? 'Prep briefing dossier generated and note attached to Contact!'
              : 'Call transcript synthesized and proposal/notes written back!'}
          </Alert>
          
          <Box padding="small" css={{ backgroundColor: '#FCF8E3', borderRadius: '4px', border: '1px solid #FBEED5' }}>
            <Heading variant="h6">Briefing Preview</Heading>
            <Box css={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
              <Text variant="small" css={{ whiteSpace: 'pre-wrap' }}>
                {actionResult.briefing}
              </Text>
            </Box>
          </Box>
        </Flex>
      )}
    </Flex>
  );
};

hubspot.extend(({ context }) => <Extension context={context} />);
