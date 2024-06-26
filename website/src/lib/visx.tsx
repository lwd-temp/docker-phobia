'use client'

import Tippy from '@tippyjs/react/headless'

import { colord } from 'colord'

import { createContext, memo, useCallback, useContext, useEffect } from 'react'

import { scaleOrdinal, scaleSqrt } from '@visx/scale'

import { treemapBinary } from '@visx/hierarchy'
import {
    HierarchyNode,
    HierarchyRectangularNode,
    treemap as d3treemap,
} from 'd3-hierarchy'

import { useSearchParams } from '@remix-run/react'
import { useMemo, useState } from 'react'
import { scheme, schemeRed } from 'website/src/lib/colors'
import { formatFileSize } from 'website/src/lib/utils'

const margin = { top: 0, left: 0, right: 0, bottom: 0 }

export type TreemapProps = {
    width: number
    height: number
    margin?: { top: number; right: number; bottom: number; left: number }
}

const white = '#fff'
const black = '#444'
const context = createContext<{
    zoomedNode: HierarchyNode<any>
    setZoomedNode: (node: HierarchyNode<any>) => void
    colorScale: Function
    deletedColorScale: Function
    layers: any[]

    fontScale: Function
}>({} as any)

export function TreemapDemo({
    node,
    width,
    height,
    layers,
}: {
    node: HierarchyNode<any>
    width: number
    height: number
    layers: any[]
}) {
    const xMax = width - margin.left - margin.right
    const yMax = height - margin.top - margin.bottom
    const [searchParams, setSearchParams] = useSearchParams()
    const [zoomedNode, setZoomedNode] = useState(node)

    const fontScale = useMemo(() => {
        const nodes = node.descendants().map((x) => x.value || 0)
        return scaleSqrt<number>()
            .domain([Math.min(...nodes)!, Math.max(...nodes)!])
            .range([12, 46])
    }, [node])

    useEffect(() => {
        if (!searchParams.get('node')) {
            setZoomedNode(node)
            return
        }
        const nodeId = Number(searchParams.get('node'))
        if (!nodeId) {
            return
        }
        const found = node.descendants().find((n) => n.data.id === nodeId)
        if (!found) {
            return
        }
        setZoomedNode(found.copy())
    }, [node, searchParams.get('node')])

    const treemapElem = useMemo(() => {
        const treemap = d3treemap<any>()
            .tile(treemapBinary)
            .size([xMax, yMax])

            .padding(7)
            .paddingTop((x) => fontScale(x.value!) + 20)

        return treemap(zoomedNode as any)
    }, [zoomedNode])

    const step = Math.ceil(scheme.length / layers.length)

    const colorScale = useMemo(
        () =>
            scaleOrdinal({
                domain: layers.map((l, i) => i),
                // skip some steps so scheme len is same as layers len

                range: scheme.filter((_, i) => i % step === 0),
            }),
        [],
    )
    const deletedColorScale = useMemo(
        () =>
            scaleOrdinal({
                domain: layers.map((l, i) => i),
                // skip some steps so scheme len is same as layers len

                range: schemeRed.filter((_, i) => i % step === 0),
            }),
        [],
    )

    if (!width || !height) {
        return null
    }
    return width < 10 ? null : (
        <context.Provider
            value={{
                // @ts-ignore
                zoomedNode,
                layers,
                setZoomedNode,
                colorScale,
                deletedColorScale,
                fontScale,
            }}
        >
            <div
                className='grow'
                style={{
                    width,
                    height,
                    position: 'relative',
                }}
            >
                {/* <rect width={width} height={height} rx={14} fill={background} /> */}

                {treemapElem.descendants().map((node, i) => (
                    <MapNode key={`node-${node.data.id}`} node={node} i={i} />
                ))}
            </div>
        </context.Provider>
    )
}

const MapNode = memo(
    ({ node, i }: { node: HierarchyRectangularNode<any>; i: number }) => {
        const { fontScale, layers, colorScale, deletedColorScale } =
            useContext(context)
        const nodeWidth = node.x1 - node.x0
        const nodeHeight = node.y1 - node.y0
        const min = 2
        const [searchParams, setSearchParams] = useSearchParams()
        const onClick = useCallback(
            (e) => {
                e.stopPropagation()
                setSearchParams((prev) => {
                    prev.set('node', node.data.id)
                    return prev
                }, {})
            },
            [node],
        )

        // if (nodeWidth < 1 || nodeHeight <div 1) {
        //     return null
        // }
        const text = `${node.data.name}`
        const showText = nodeWidth > 40 && nodeHeight > 14

        function getBg(node) {
            if (!node) {
                return 'transparent'
            }
            if (node.data.deleted) {
                return deletedColorScale(node.data.layer || 0)
            }
            return colorScale(node.data.layer || 0)
        }
        const backgroundColor = getBg(node)

        const textColor = useMemo(() => {
            const color = colord(backgroundColor)
            if (color.isLight()) {
                return black
            }
            return white
        }, [backgroundColor])

        const borderColor = useMemo(() => {
            const backgroundColorOut = getBg(node.parent)
            const color = colord(backgroundColorOut)
            if (color.isLight()) {
                return black
            }
            if (textColor === white) {
                return white
            }
        }, [textColor])
        if (!nodeWidth || !nodeHeight || nodeWidth < min || nodeHeight < min) {
            return null
        }

        return (
            <div
                key={`node-${node.data.id}`}
                style={{
                    position: 'absolute',
                    top: node.y0 + margin.top,
                    left: node.x0 + margin.left,
                }}
                // layout
                className='cursor-pointer'
                onClick={onClick}
            >
                <div
                    style={{
                        width: nodeWidth,
                        height: nodeHeight,
                        backgroundColor,
                        borderColor,
                        borderWidth: 2,
                    }}
                    className='flex flex-col pl-2'
                >
                    {showText && (
                        <Tippy
                            render={(attrs) => {
                                const layer = layers.find(
                                    (l, i) => i === node.data.layer,
                                )
                                return (
                                    <div
                                        {...attrs}
                                        className='text-white text-xs flex flex-col gap-1 font-mono max-w-[800px] rounded p-2 bg-black'
                                    >
                                        <div className=''>
                                            path: {nodeToPath(node)}
                                        </div>
                                        <div className='truncate'>
                                            layer: {layer?.command}
                                        </div>
                                        <div className='truncate'>
                                            size: {formatFileSize(node.value)}
                                        </div>
                                    </div>
                                )
                            }}
                        >
                            <div
                                className='text-black truncate w-fit '
                                style={{
                                    maxWidth: nodeWidth - 4,
                                    maxHeight: nodeHeight - 4,
                                    color: textColor,
                                    fontSize: fontScale(node.value),
                                }}
                                data-tippy-content={text}
                                children={text}
                            />
                        </Tippy>
                    )}
                </div>
            </div>
        )
    },
)

function nodeToPath(node: HierarchyNode<any>) {
    const path = [] as string[]
    let current = node
    while (current) {
        path.push(current!.data.name)
        current = current.parent!
    }
    return path.reverse().join('/')
}
