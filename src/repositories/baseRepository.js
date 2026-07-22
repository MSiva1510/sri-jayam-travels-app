import supabase from '../lib/supabase'

export class BaseRepository {
  constructor(tableName, primaryKey = 'id') {
    this.tableName = tableName
    this.primaryKey = primaryKey
  }

  async getAll() {
    return this._getAllFromSupabase()
  }

  async getById(id) {
    return this._getByIdFromSupabase(id)
  }

  async create(data) {
    return this._createInSupabase(data)
  }

  async update(id, data) {
    return this._updateInSupabase(id, data)
  }

  async delete(id) {
    return this._deleteFromSupabase(id)
  }

  async _getAllFromSupabase() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')

    if (error) throw error
    return data || []
  }

  async _getByIdFromSupabase(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq(this.primaryKey, id)
      .single()

    if (error && error.code === 'PGRST116') return null
    if (error) throw error
    return data || null
  }

  async _createInSupabase(data) {
    const item = {
      ...data,
      createdAt: data.createdAt || new Date().toISOString(),
    }

    const { data: created, error } = await supabase
      .from(this.tableName)
      .insert([item])
      .select()
      .single()

    if (error) throw error
    return created
  }

  async _updateInSupabase(id, data) {
    const update = {
      ...data,
      updatedAt: new Date().toISOString(),
    }

    const { data: updated, error } = await supabase
      .from(this.tableName)
      .update(update)
      .eq(this.primaryKey, id)
      .select()
      .single()

    if (error) throw error
    return updated
  }

  async _deleteFromSupabase(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq(this.primaryKey, id)

    if (error) throw error
    return true
  }
}

export default BaseRepository
