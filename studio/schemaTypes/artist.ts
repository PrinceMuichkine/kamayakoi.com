import {defineType, defineField} from 'sanity'
import {UsersIcon} from '@sanity/icons' // Optional: Add an icon

export default defineType({
  name: 'artist',
  title: 'Artists',
  type: 'document',
  icon: UsersIcon, // Optional icon
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'name',
        maxLength: 96,
      },
      description: 'Unique identifier for the artist, used for URLs if needed.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'image',
      title: 'Image',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({
      name: 'socialLink',
      title: 'Social Media Link',
      type: 'url',
      description:
        'Link to their primary social media profile (e.g., Instagram, Twitter, Website).',
    }),
    defineField({
      name: 'isResident',
      title: 'Is Resident?',
      type: 'boolean',
      initialValue: false,
      description: 'Check if this artist is a resident for the event series or venue.',
    }),
    defineField({
      name: 'role',
      title: 'Role/Title',
      type: 'string',
      options: {
        list: [
          {title: 'Artist / Artiste', value: 'artist'},
          {title: 'Resident', value: 'resident'},
          {title: 'Host / Animateur', value: 'host'},
          {title: 'MC', value: 'mc'},
          {title: 'Producer / Producteur', value: 'producer'},
          {title: 'DJ', value: 'dj'},
        ],
        layout: 'dropdown',
      },
      initialValue: 'artist',
      description: 'Role or title of the artist in the collective.',
    }),
    defineField({
      name: 'socialHandle',
      title: 'Social Handle',
      type: 'string',
      description: 'Username without @ symbol (e.g., johndoe)',
      placeholder: 'johndoe',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'object',
      description: 'Longer description/biography of the artist for detailed display',
      fields: [
        {
          name: 'en',
          title: 'English',
          type: 'text',
          rows: 8,
        },
        {
          name: 'fr',
          title: 'Français',
          type: 'text',
          rows: 8,
        },
      ],
    }),
    defineField({
      name: 'video',
      title: 'Artist Video',
      type: 'file',
      description: 'Optional video showcasing the artist (supports MP4, WebM, etc.)',
      options: {
        accept: 'video/*',
      },
      fields: [
        {
          name: 'caption',
          title: 'Video Caption',
          type: 'string',
          description: 'Optional caption for the video',
        },
      ],
    }),
    // Add any other relevant fields for artists here
  ],
  preview: {
    select: {
      title: 'name',
      media: 'image',
    },
    prepare({title, media}) {
      return {
        title: title,
        media: media,
      }
    },
  },
})
