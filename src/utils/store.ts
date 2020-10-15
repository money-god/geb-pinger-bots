import { S3 } from 'aws-sdk'

export class Store {
  private s3: S3
  constructor(private bucket: string, awsId: string, awsSecret: string) {
    this.s3 = new S3({ accessKeyId: awsId, secretAccessKey: awsSecret })
  }

  public async putJson(key: string, data: string) {
    const that = this
    return new Promise<void>((res, err) => {
      that.s3.putObject(
        {
          Bucket: this.bucket,
          Body: data,
          Key: key,
          ContentType: 'application/json',
        },
        (e, _) => {
          if (err) {
            err('Could not write to S3' + e.message)
          } else {
            res()
          }
        }
      )
    })
  }

  public async getJson(key: string) {
    const that = this
    return new Promise<Object>((res, err) => {
      that.s3.getObject(
        {
          Bucket: this.bucket,
          Key: key,
        },
        (e, r) => {
          if (err) {
            err('Could not read from S3' + e.message)
          } else {
            res(JSON.parse(r.Body?.toString('utf-8') as string))
          }
        }
      )
    })
  }

  public async mergedPutJson(key: string, data: string) {
    function isObject(item) {
      return item && typeof item === 'object' && !Array.isArray(item)
    }

    function mergeDeep(target, ...sources) {
      if (!sources.length) return target
      const source = sources.shift()

      if (isObject(target) && isObject(source)) {
        for (const key in source) {
          if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} })
            mergeDeep(target[key], source[key])
          } else {
            Object.assign(target, { [key]: source[key] })
          }
        }
      }

      return mergeDeep(target, ...sources)
    }

    const sav = await this.getJson(key)
    const merged = mergeDeep(sav, data)
    await this.putJson(key, merged)
  }
}