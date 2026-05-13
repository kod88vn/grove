'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export function SkillsLibrary({ studentId = 'default' }) {
  const [catalog, setCatalog] = useState([])
  const [summary, setSummary] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [categoryItems, setCategoryItems] = useState([])
  const [loadingItems, setLoadingItems] = useState(false)

  // Fetch catalog + summary + stats on mount
  useEffect(() => {
    async function fetchCatalog() {
      try {
        const res = await fetch('/api/nora-homework/library?view=catalog')
        if (res.ok) {
          const data = await res.json()
          const categories = data.categories || []
          setCatalog(categories)
          if (categories.length > 0) {
            setSelectedCategory(categories[0].key)
          }
        }
      } catch (error) {
        console.error('Error fetching skills catalog:', error)
      }
    }

    async function fetchSummary() {
      try {
        const res = await fetch(`/api/nora-homework/library?studentId=${studentId}&view=summary`)
        if (res.ok) {
          const data = await res.json()
          setSummary(data.summary || [])
        }
      } catch (error) {
        console.error('Error fetching skills summary:', error)
      }
    }

    async function fetchStats() {
      try {
        const res = await fetch(`/api/nora-homework/library?studentId=${studentId}&view=stats`)
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    Promise.all([fetchCatalog(), fetchSummary(), fetchStats()]).finally(() => setLoading(false))
  }, [studentId])

  // Fetch items for selected category
  useEffect(() => {
    if (!selectedCategory) return

    async function fetchItems() {
      setLoadingItems(true)
      try {
        const res = await fetch(
          `/api/nora-homework/library?studentId=${studentId}&skillCategory=${selectedCategory}`
        )
        if (res.ok) {
          const data = await res.json()
          setCategoryItems(data.items || [])
        }
      } catch (error) {
        console.error('Error fetching category items:', error)
      } finally {
        setLoadingItems(false)
      }
    }

    fetchItems()
  }, [selectedCategory, studentId])

  const selectedCatalogCategory = catalog.find((category) => category.key === selectedCategory)

  // Build a lookup so each catalog skill can show attempts/average from history
  const summaryMap = summary.reduce((map, item) => {
    const key = `${item.skill_category}::${normalizeSkill(item.skill_name)}`
    map[key] = item
    return map
  }, {})

  return (
    <div className="flex flex-col gap-6 p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-4xl font-bold text-slate-800">📚 Skills Library</h1>
        <p className="text-slate-600 mt-2">
          Browse Grade 5 skills by category and review your completed problems.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="text-4xl font-bold text-blue-600">{stats.totalProblems}</div>
            <div className="text-slate-600 text-sm">Problems Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
            <div className="text-4xl font-bold text-green-600">{stats.skillsAttempted}</div>
            <div className="text-slate-600 text-sm">Skills Mastered</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
            <div className="text-4xl font-bold text-purple-600">{stats.averageScore?.toFixed(1)}%</div>
            <div className="text-slate-600 text-sm">Average Score</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="text-slate-600">Loading your skills library...</div>
        </div>
      ) : catalog.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="text-slate-600 text-lg">Could not load the skill catalog.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 sticky top-4">
              <h2 className="font-semibold text-slate-800 mb-4">Grade 5 Categories</h2>
              <div className="flex flex-col gap-2">
                {catalog.map((category) => {
                  const attemptedCount = summary.filter((item) => item.skill_category === category.key).length
                  return (
                  <button
                    key={category.key}
                    onClick={() => setSelectedCategory(category.key)}
                    className={`text-left px-4 py-2 rounded-lg transition ${
                      selectedCategory === category.key
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <div className="font-medium text-sm">{category.category}</div>
                    <div className="text-xs opacity-75">
                      {attemptedCount}/{category.skills.length} started
                    </div>
                  </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Skills Display */}
          <div className="lg:col-span-2">
            {!selectedCatalogCategory ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <div className="text-slate-600">Select a category to view skills.</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-6 py-4">
                    <h3 className="font-semibold text-lg">{selectedCatalogCategory.category}</h3>
                    <p className="text-xs mt-1 text-slate-200">
                      {selectedCatalogCategory.skills.length} skills in this category
                    </p>
                    <div className="mt-3">
                      <Link
                        href={`/?section=math&practice=1&skillCategory=${encodeURIComponent(
                          selectedCatalogCategory.key
                        )}`}
                        className="inline-flex rounded bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30"
                      >
                        Practice This Section
                      </Link>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedCatalogCategory.skills.map((skill) => {
                      const progress =
                        summaryMap[
                          `${selectedCatalogCategory.key}::${normalizeSkill(skill.name)}`
                        ]
                      return (
                        <CatalogSkillCard
                          key={skill.id}
                          skill={skill}
                          progress={progress}
                        />
                      )
                    })}
                  </div>
                </div>

                {loadingItems ? (
              <div className="text-center py-12 bg-white rounded-lg">
                <div className="text-slate-600">Loading problems...</div>
              </div>
                ) : (
                  <div className="bg-white rounded-lg shadow-md p-4">
                    <h4 className="font-semibold text-slate-800 mb-3">Recent Attempts</h4>
                {categoryItems.length === 0 ? (
                        <div className="rounded bg-slate-50 p-6 text-center text-slate-600">
                          No attempts yet in this category.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {categoryItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-semibold text-slate-800">{item.skill_label}</div>
                                  <div className="text-sm text-slate-600 mt-1">{item.problem_text}</div>
                                </div>
                                <div className="text-right">
                                  <div
                                    className={`text-lg font-bold ${
                                      item.score === item.max_score
                                        ? 'text-green-600'
                                        : 'text-orange-600'
                                    }`}
                                  >
                                    {item.score}/{item.max_score}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {new Date(item.created_at * 1000).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function normalizeSkill(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function CatalogSkillCard({ skill, progress }) {
  const averagePercent = progress ? Math.round(progress.averageScore) : null
  const statusLabel = progress ? `${progress.attempts} attempts` : 'Not started'
  const statusClass = progress
    ? averagePercent >= 80
      ? 'text-green-700 bg-green-100'
      : averagePercent >= 60
        ? 'text-yellow-700 bg-yellow-100'
        : 'text-orange-700 bg-orange-100'
    : 'text-slate-600 bg-slate-100'

  return (
    <div className="flex items-start justify-between gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
      <div className="flex-1">
        <div className="font-medium text-slate-800">{skill.label}</div>
        <div className="text-sm text-slate-600 mt-1">{skill.description}</div>
      </div>
      <div className="text-right min-w-[110px]">
        <div className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
          {statusLabel}
        </div>
        {averagePercent !== null && (
          <div className="mt-2 text-lg font-bold text-slate-800">{averagePercent}%</div>
        )}
      </div>
    </div>
  )
}
