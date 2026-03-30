import { useCallback, useState } from 'react';
import { processCSVComparison as localProcessCSVComparison } from '../../../MainApp/StormMasterList/SMLogic';
import { readFileAsText } from '../../../services/fileParsers';
import {
  hasGoogleScriptRuntime,
  processAIAgentCommandRemote
} from '../../../services/googleAppsScript';

const AI_IGNORE_WORDS = [
  'CHANGE', 'UPDATE', 'SET', 'MODIFY', 'STATUS', 'MAKE', 'PUT', 'ADD',
  'TO', 'FROM', 'THE', 'IN', 'OF', 'ON', 'FOR', 'AND', 'WITH',
  'VERIFIED', 'NEW', 'MISMATCH', 'REMOVED', 'UNCHANGED',
  'SITE', 'SITES', 'REMARK', 'REMARKS', 'ID', 'PLA', 'BCF', 'NAME',
  'PLEASE', 'CAN', 'YOU', 'COULD', 'WOULD', 'JUST', 'HELP', 'ME', 'WANT', 'NEED',
  'LIST', 'SHOW', 'FIND', 'COUNT', 'ALL'
];

function buildAiPayload(userMessage, results) {
  const searchWords = userMessage
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !AI_IGNORE_WORDS.includes(word));

  const relevantData = searchWords.length > 0
    ? results.filter((row) => {
        const rowData = `${row.plaId} ${row.baseLocation} ${row.nmsName}`.toUpperCase();
        return searchWords.some((word) => rowData.includes(word));
      })
    : [];

  const finalDataToSend = relevantData.length > 0 ? relevantData.slice(0, 250) : results.slice(0, 50);

  return finalDataToSend.map((row) => ({
    plaId: row.plaId,
    matchStatus: row.matchStatus,
    baseLocation: row.baseLocation,
    nmsName: row.nmsName,
    remarks: row.remarks
  }));
}

function applyAiMutations(results, mutations) {
  let actualChangesCount = 0;

  const updatedResults = results.map((row) => {
    const change = mutations.find((mutation) => mutation && mutation.plaId === row.plaId);
    if (!change || !change.updates) {
      return row;
    }

    actualChangesCount++;
    return {
      ...row,
      matchStatus: change.updates.matchStatus || row.matchStatus || 'UNCHANGED',
      remarks: change.updates.remarks ? `(AI) ${change.updates.remarks}` : row.remarks
    };
  });

  return { updatedResults, actualChangesCount };
}

export default function useStormMasterlistProcessor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const scanFiles = useCallback(async (nmsFile, udmFile) => {
    if (!nmsFile || !udmFile) {
      throw new Error('Please upload both CSV files.');
    }

    setIsLoading(true);
    try {
      const [nmsText, udmText] = await Promise.all([
        readFileAsText(nmsFile),
        readFileAsText(udmFile)
      ]);

      const localResult = localProcessCSVComparison(nmsText, udmText);
      if (localResult?.success) {
        return localResult.data;
      }

      throw new Error(localResult?.error || 'Unknown parse error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runAiCommand = useCallback(async (userMessage, results) => {
    if (!userMessage.trim()) {
      return { messages: [], updatedResults: null };
    }

    setIsAiLoading(true);
    try {
      if (!hasGoogleScriptRuntime()) {
        return {
          messages: [{ sender: 'ai', text: "I'm running locally. Google Apps Script is offline." }],
          updatedResults: null
        };
      }

      const payloadRows = buildAiPayload(userMessage, results);
      const aiResponse = await processAIAgentCommandRemote(userMessage, JSON.stringify(payloadRows));
      const messages = [];

      if (!aiResponse) {
        messages.push({ sender: 'system', text: 'AI returned an empty response.', isError: true });
        return { messages, updatedResults: null };
      }

      if (aiResponse.error) {
        messages.push({ sender: 'system', text: `System Error: ${aiResponse.error}`, isError: true });
        return { messages, updatedResults: null };
      }

      const replyText = aiResponse.reply || aiResponse.response || aiResponse.message || aiResponse.text;
      if (replyText) {
        messages.push({ sender: 'ai', text: replyText });
      } else if (!Array.isArray(aiResponse.mutations) || aiResponse.mutations.length === 0) {
        messages.push({ sender: 'ai', text: `[Raw Output]: ${JSON.stringify(aiResponse)}` });
      }

      if (Array.isArray(aiResponse.mutations) && aiResponse.mutations.length > 0) {
        try {
          const { updatedResults, actualChangesCount } = applyAiMutations(results, aiResponse.mutations);
          if (actualChangesCount > 0) {
            messages.push({ sender: 'system', text: `Successfully applied updates to ${actualChangesCount} rows.` });
            return { messages, updatedResults };
          }
        } catch {
          messages.push({ sender: 'system', text: 'Table protected from corrupted AI data.', isError: true });
        }
      }

      return { messages, updatedResults: null };
    } catch (error) {
      return {
        messages: [{ sender: 'system', text: `Network Timeout: ${error.message || error}`, isError: true }],
        updatedResults: null
      };
    } finally {
      setIsAiLoading(false);
    }
  }, []);

  return {
    isLoading,
    isAiLoading,
    scanFiles,
    runAiCommand
  };
}
