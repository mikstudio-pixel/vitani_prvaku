import type { ScenarioStage } from '../lib/mixing-scenario';
import standby from './artwork/right-standby.svg';
import standbyMarkup from './artwork/right-standby.svg?raw';
import detected from './artwork/scenario/detected.svg';
import detectedMarkup from './artwork/scenario/detected.svg?raw';
import authorized from './artwork/scenario/authorized.svg';
import authorizedMarkup from './artwork/scenario/authorized.svg?raw';
import decision from './artwork/scenario/decision.svg';
import decisionMarkup from './artwork/scenario/decision.svg?raw';
import countdown from './artwork/scenario/countdown.svg';
import countdownMarkup from './artwork/scenario/countdown.svg?raw';
import analysis from './artwork/scenario/analysis.svg';
import analysisMarkup from './artwork/scenario/analysis.svg?raw';
import mixing from './artwork/scenario/mixing.svg';
import mixingMarkup from './artwork/scenario/mixing.svg?raw';
import keepMixing from './artwork/scenario/keep-mixing.svg';
import keepMixingMarkup from './artwork/scenario/keep-mixing.svg?raw';
import notMixing from './artwork/scenario/not-mixing.svg';
import notMixingMarkup from './artwork/scenario/not-mixing.svg?raw';
import stirPrompt from './artwork/scenario/stir-prompt.svg';
import stirPromptMarkup from './artwork/scenario/stir-prompt.svg?raw';
import success from './artwork/scenario/success.svg';
import successMarkup from './artwork/scenario/success.svg?raw';
import failure from './artwork/scenario/failure.svg';
import failureMarkup from './artwork/scenario/failure.svg?raw';
import bonAppetit from './artwork/scenario/bon-appetit.svg';
import bonAppetitMarkup from './artwork/scenario/bon-appetit.svg?raw';
import hungry from './artwork/scenario/hungry.svg';
import hungryMarkup from './artwork/scenario/hungry.svg?raw';

import connected from './artwork/scenario/connected.svg';
import connectedMarkup from './artwork/scenario/connected.svg?raw';

export const SCREENS: Record<ScenarioStage, { artwork: string; markup: string; title: string }> = {
  standby: { artwork: standby, markup: standbyMarkup, title: 'Posádka detekována. Mícháš nebo nemícháš?' },
  detected: { artwork: detected, markup: detectedMarkup, title: 'Posádka detekována. Mícháš nebo nemícháš?' },
  panels: { artwork: authorized, markup: authorizedMarkup, title: 'Mícháš nebo nemícháš?' },
  authorized: { artwork: authorized, markup: authorizedMarkup, title: 'Mícháš nebo nemícháš?' },
  decision: { artwork: decision, markup: decisionMarkup, title: 'Mícháš nebo nemícháš?' },
  countdown: { artwork: countdown, markup: countdownMarkup, title: 'Mícháš nebo nemícháš? 3… 2… 1…' },
  analysis: { artwork: analysis, markup: analysisMarkup, title: 'Míchej!!!' },
  mixing: { artwork: mixing, markup: mixingMarkup, title: 'Jde ti to dobře!!' },
  'keep-mixing': { artwork: keepMixing, markup: keepMixingMarkup, title: 'Míchač se pozná!' },
  'stir-prompt': { artwork: stirPrompt, markup: stirPromptMarkup, title: 'Tak míchej ne?!?' },
  'not-mixing': { artwork: notMixing, markup: notMixingMarkup, title: 'Míchej pořádně!!!' },
  finishing: { artwork: keepMixing, markup: keepMixingMarkup, title: 'Míchač se pozná!' },
  success: { artwork: success, markup: successMarkup, title: 'Míchač se pozná! 100 %' },
  failure: { artwork: failure, markup: failureMarkup, title: 'Kaše nezamíchána. Budeš o hladu!!' },
  'bon-appetit': { artwork: bonAppetit, markup: bonAppetitMarkup, title: 'Domícháno! Dobrou chuť.' },
  hungry: { artwork: hungry, markup: hungryMarkup, title: 'Na Digitál chceme jenom pořádné míchače. Počkej 15 sekund a zkus to znovu.' },
  connecting: { artwork: connected, markup: connectedMarkup, title: 'Spojení s kolonií navázáno. Příchozí zpráva od Boba Stránského. Koukej, co u nás vaříme za instantní parády!' },
  restart: { artwork: connected, markup: connectedMarkup, title: 'Spojení s kolonií navázáno. Příchozí zpráva od Boba Stránského. Koukej, co u nás vaříme za instantní parády!' },
  welcome: { artwork: connected, markup: connectedMarkup, title: 'Spojení s kolonií navázáno. Příchozí zpráva od Boba Stránského. Koukej, co u nás vaříme za instantní parády!' },
};
