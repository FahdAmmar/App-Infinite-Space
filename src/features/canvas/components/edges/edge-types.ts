import type { EdgeTypes } from '@xyflow/react'
import { ConnectionEdge } from './ConnectionEdge'

/** سجل أنواع الوصلات: كائن ثابت على مستوى الوحدة لنفس سبب nodeTypes. */
export const edgeTypes = { connection: ConnectionEdge } satisfies EdgeTypes
