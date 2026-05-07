import { classifyIntent } from './classifier.js'
import { getSkillDefinition } from './skillRegistry.js'

function buildFactualToolArguments(message) {
  const query = String(message || '').trim()
  if (!query) return {}
  return { query }
}

function buildDashboardPlan(intent, context) {
  const skill = getSkillDefinition('dashboard_profile')

  return {
    ...intent,
    intent: intent.intent || 'dashboard_profile',
    route: 'structured_data',
    surface: context.surface || 'dashboard_profile',
    skillSet: [skill.id],
    toolPlan: [
      {
        type: 'external_api',
        name: 'dashboard_provider',
      },
    ],
    responseMode: skill.responseMode,
    schemaName: skill.schemaName,
    verificationPolicy: skill.verificationPolicy,
    allowProse: skill.allowProse,
    useModel: false,
    skipToolPlanning: false,
    promptProfile: skill.modelProfile,
    requireVerification: true,
  }
}

function buildWeatherPlan(intent, context) {
  const skill = getSkillDefinition('weather_widget')

  return {
    ...intent,
    intent: intent.intent || 'weather',
    route: 'structured_data',
    surface: context.surface || 'weather_widget',
    skillSet: [skill.id],
    toolPlan: [
      {
        type: 'external_api',
        name: 'weather_provider',
      },
    ],
    responseMode: skill.responseMode,
    schemaName: skill.schemaName,
    verificationPolicy: skill.verificationPolicy,
    allowProse: skill.allowProse,
    useModel: false,
    skipToolPlanning: false,
    promptProfile: skill.modelProfile,
    requireVerification: true,
  }
}

export function buildExecutionPlan(message, context = {}) {
  const intent = classifyIntent(message)

  if (context.surface === 'dashboard_profile') {
    return buildDashboardPlan(intent, context)
  }

  if (context.surface === 'weather_widget' || intent.intent === 'weather') {
    return buildWeatherPlan(intent, context)
  }

  if (intent.route === 'local_tool') {
    const skill = getSkillDefinition('local_time')

    return {
      ...intent,
      surface: context.surface || 'chat',
      skillSet: [skill.id],
      toolPlan: [{ type: 'local_tool', name: intent.toolName }],
      responseMode: skill.responseMode,
      schemaName: skill.schemaName,
      verificationPolicy: skill.verificationPolicy,
      allowProse: skill.allowProse,
      useModel: false,
      skipToolPlanning: true,
      promptProfile: skill.modelProfile,
      requireVerification: false,
    }
  }

  if (intent.route === 'fast_chat') {
    const skill = getSkillDefinition('general_family_chat')

    return {
      ...intent,
      surface: context.surface || 'chat',
      skillSet: [skill.id],
      toolPlan: [],
      responseMode: skill.responseMode,
      schemaName: skill.schemaName,
      verificationPolicy: skill.verificationPolicy,
      allowProse: skill.allowProse,
      useModel: true,
      skipToolPlanning: true,
      promptProfile: skill.modelProfile,
      requireVerification: false,
    }
  }

  if (intent.route === 'reasoning') {
    const skill = getSkillDefinition('planning_reasoning')

    return {
      ...intent,
      surface: context.surface || 'chat',
      skillSet: [skill.id],
      toolPlan: [{ type: 'planner', name: 'multi_step_reasoning' }],
      responseMode: skill.responseMode,
      schemaName: skill.schemaName,
      verificationPolicy: skill.verificationPolicy,
      allowProse: skill.allowProse,
      useModel: true,
      skipToolPlanning: false,
      promptProfile: skill.modelProfile,
      requireVerification: true,
    }
  }

  const skill = getSkillDefinition('search_and_summarize')

  return {
    ...intent,
    surface: context.surface || 'chat',
    skillSet: [skill.id],
    toolPlan: [{ type: 'mcp_tool', name: 'factual_lookup', arguments: buildFactualToolArguments(message) }],
    responseMode: skill.responseMode,
    schemaName: skill.schemaName,
    verificationPolicy: skill.verificationPolicy,
    allowProse: skill.allowProse,
    useModel: true,
    skipToolPlanning: false,
    promptProfile: skill.modelProfile,
    requireVerification: true,
  }
}